// barbed-app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Your Firebase config here (replace with your actual keys)
const firebaseConfig = {
  apiKey: "AIzaSyD5pvVnrSpeG_vsIhpuxDtNWn8_LpJ0Njk",
  authDomain: "mossmedia-6c7c0.firebaseapp.com",
  projectId: "mossmedia-6c7c0",
  storageBucket: "mossmedia-6c7c0.firebasestorage.app",
  messagingSenderId: "508263350192",
  appId: "1:508263350192:web:e89eeae0eede7b770ee075"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// DOM Elements
const authSection = document.getElementById("auth-section");
const profileSection = document.getElementById("profile-section");
const postSection = document.getElementById("post-section");
const feedSection = document.getElementById("feed");
const chatSection = document.getElementById("chat-section");

const profileUsername = document.getElementById("profile-username");
const profilePic = document.getElementById("profile-pic");
const profileEmail = document.getElementById("profile-email");
const followerCount = document.getElementById("follower-count");
const followingCount = document.getElementById("following-count");

let currentUser = null;
let unsubscribeFeed = null;
let unsubscribeMessages = null;
let currentChatConvoId = null;

// ------------------- AUTH ---------------------

// Sign up with email, password, username, and optional profile picture file
async function signUp() {
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();
  const username = document.getElementById("signup-username").value.trim();
  const profilePicFile = document.getElementById("signup-profile-pic-file").files[0]; // Expect a file input now

  if (!email || !password || !username) {
    alert("Email, password, and username are required.");
    return;
  }

  try {
    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;

    // Upload profile pic if any
    let photoURL = "";
    if (profilePicFile) {
      const picRef = storageRef(storage, `profilePics/${currentUser.uid}`);
      await uploadBytes(picRef, profilePicFile);
      photoURL = await getDownloadURL(picRef);
    }

    // Update Firebase Auth profile
    await updateProfile(currentUser, {
      displayName: username,
      photoURL: photoURL || ""
    });

    // Create user document in Firestore
    await setDoc(doc(db, "users", currentUser.uid), {
      email,
      username,
      profilePicUrl: photoURL || "",
      followers: [],
      following: [],
      createdAt: serverTimestamp()
    });

    alert("Signup successful!");
    showUserProfile();
  } catch (error) {
    console.error("Signup error:", error);
    alert(error.message);
  }
}

// Login with email and password
async function login() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    showUserProfile();
  } catch (error) {
    console.error("Login error:", error);
    alert(error.message);
  }
}

// Login with Google popup
async function googleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;

    // Check if user doc exists; if not, create it
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: currentUser.email,
        username: currentUser.displayName || "GoogleUser",
        profilePicUrl: currentUser.photoURL || "",
        followers: [],
        following: [],
        createdAt: serverTimestamp()
      });
    }
    showUserProfile();
  } catch (error) {
    console.error("Google login error:", error);
    alert(error.message);
  }
}

// Logout function
async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
    if (unsubscribeFeed) unsubscribeFeed();
    if (unsubscribeMessages) unsubscribeMessages();
    showAuthSection();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// Listen to auth state changes
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    showUserProfile();
  } else {
    currentUser = null;
    showAuthSection();
  }
});

// ------------------- UI & PROFILE ---------------------

function showAuthSection() {
  authSection.classList.remove("hidden");
  profileSection.classList.add("hidden");
  postSection.classList.add("hidden");
  feedSection.classList.add("hidden");
  chatSection.classList.add("hidden");
}

async function showUserProfile() {
  authSection.classList.add("hidden");
  profileSection.classList.remove("hidden");
  postSection.classList.remove("hidden");
  feedSection.classList.remove("hidden");
  chatSection.classList.remove("hidden");

  // Load user info from Firestore
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if (!userDoc.exists()) {
    alert("User data not found!");
    return;
  }
  const userData = userDoc.data();

  profileUsername.textContent = userData.username || currentUser.displayName || "User";
  profileEmail.textContent = currentUser.email;
  profilePic.src = userData.profilePicUrl || "default-profile.png";
  followerCount.textContent = userData.followers?.length || 0;
  followingCount.textContent = userData.following?.length || 0;

  subscribeToFeed();
}

// ------------------- POSTING ---------------------

// Submit a new post
async function submitPost() {
  const content = document.getElementById("post-input").value.trim();
  if (!content) {
    alert("Post cannot be empty");
    return;
  }

  try {
    await addDoc(collection(db, "posts"), {
      userId: currentUser.uid,
      content,
      timestamp: serverTimestamp()
    });
    document.getElementById("post-input").value = "";
  } catch (error) {
    console.error("Post submit error:", error);
  }
}

// Subscribe to real-time post feed
function subscribeToFeed() {
  if (unsubscribeFeed) unsubscribeFeed();

  const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));
  unsubscribeFeed = onSnapshot(postsQuery, async (snapshot) => {
    feedSection.innerHTML = "<h2>Feed</h2>";
    for (const docSnap of snapshot.docs) {
      const post = docSnap.data();

      // Get post author info
      const userDoc = await getDoc(doc(db, "users", post.userId));
      const user = userDoc.exists() ? userDoc.data() : { username: "Unknown", profilePicUrl: "" };

      const postEl = document.createElement("div");
      postEl.className = "post";

      postEl.innerHTML = `
        <div class="post-header">
          <img src="${user.profilePicUrl || "default-profile.png"}" alt="Profile" />
          <strong>${user.username}</strong>
        </div>
        <div class="post-content">${post.content}</div>
      `;

      feedSection.appendChild(postEl);
    }
  });
}

// ------------------- FRIENDS SYSTEM ---------------------

// Follow a user
async function followUser(targetUserId) {
  if (!currentUser) return;

  const currentUserRef = doc(db, "users", currentUser.uid);
  const targetUserRef = doc(db, "users", targetUserId);

  await updateDoc(currentUserRef, { following: arrayUnion(targetUserId) });
  await updateDoc(targetUserRef, { followers: arrayUnion(currentUser.uid) });

  alert("Followed user!");
  await showUserProfile(); // Refresh follower/following counts
}

// Unfollow a user
async function unfollowUser(targetUserId) {
  if (!currentUser) return;

  const currentUserRef = doc(db, "users", currentUser.uid);
  const targetUserRef = doc(db, "users", targetUserId);

  await updateDoc(currentUserRef, { following: arrayRemove(targetUserId) });
  await updateDoc(targetUserRef, { followers: arrayRemove(currentUser.uid) });

  alert("Unfollowed user!");
  await showUserProfile(); // Refresh follower/following counts
}

// ------------------- DIRECT MESSAGING ---------------------

// Generate conversation ID consistently (sorted)
function getConvoId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

async function sendMessage(receiverEmail, text) {
  if (!currentUser) return;
  if (!text.trim()) return alert("Message cannot be empty.");

  // Get receiver user id by email
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", receiverEmail));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    alert("User not found");
    return;
  }
  const receiverDoc = querySnapshot.docs[0];
  const receiverId = receiverDoc.id;

  const convoId = getConvoId(currentUser.uid, receiverId);
  const messagesRef = collection(db, "messages", convoId, "messages");

  await addDoc(messagesRef, {
    senderId: currentUser.uid,
    text,
    timestamp: serverTimestamp(),
  });
}

// Listen to messages in a convo and update chat UI
function listenToMessages(receiverEmail) {
  if (!currentUser) return;
  if (unsubscribeMessages) unsubscribeMessages();

  getDocs(query(collection(db, "users"), where("email", "==", receiverEmail)))
    .then(snapshot => {
      if (snapshot.empty) {
        alert("User not found");
        return;
      }
      const receiverId = snapshot.docs[0].id;
      currentChatConvoId = getConvoId(currentUser.uid, receiverId);
      const messagesRef = collection(db, "messages", currentChatConvoId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp"));

      unsubscribeMessages = onSnapshot(messagesQuery, snapshot => {
        chatSection.innerHTML = "<h3>Chat</h3>";
        snapshot.forEach(doc => {
          const message = doc.data();
          const isMine = message.senderId === currentUser.uid;
          const msgDiv = document.createElement("div");
          msgDiv.className = isMine ? "my-msg" : "their-msg";
          msgDiv.textContent = message.text;
          chatSection.appendChild(msgDiv);
        });
      });
    })
    .catch(err => console.error(err));
}

// ------------------- EVENT LISTENERS ---------------------

// Example buttons, inputs, etc. should be linked to these functions in your HTML

document.getElementById("signup-btn").onclick = signUp;
document.getElementById("login-btn").onclick = login;
document.getElementById("google-login-btn").onclick = googleLogin;
document.getElementById("logout-btn").onclick = logout;

document.getElementById("post-submit-btn").onclick = submitPost;

// Example: send message button and input
document.getElementById("send-msg-btn").onclick = () => {
  const receiverEmail = document.getElementById("chat-email-input").value.trim();
  const msgText = document.getElementById("chat-msg-input").value.trim();
  sendMessage(receiverEmail, msgText);
  document.getElementById("chat-msg-input").value = "";
};

// To listen to messages for a user, call listenToMessages(receiverEmail) when starting a chat


// barbed-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5pvVnrSpeG_vsIhpuxDtNWn8_LpJ0Njk",
  authDomain: "mossmedia-6c7c0.firebaseapp.com",
  projectId: "mossmedia-6c7c0",
  storageBucket: "mossmedia-6c7c0.firebasestorage.app",
  messagingSenderId: "508263350192",
  appId: "1:508263350192:web:e89eeae0eede7b770ee075"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const googleProvider = new GoogleAuthProvider();

// UI elements
const authSection = document.getElementById("auth-section");
const profileSection = document.getElementById("profile-section");
const postSection = document.getElementById("post-section");
const feedSection = document.getElementById("feed");
const chatSection = document.getElementById("chat-section");

const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupUsername = document.getElementById("signup-username");
const signupProfilePic = document.getElementById("signup-profile-pic");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");

const profileUsername = document.getElementById("profile-username");
const profilePic = document.getElementById("profile-pic");
const profileEmail = document.getElementById("profile-email");
const followerCount = document.getElementById("follower-count");
const followingCount = document.getElementById("following-count");

const postInput = document.getElementById("post-input");
const feed = document.getElementById("feed");

const chatUserInput = document.getElementById("chat-user-email");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");

let currentUser = null;
let currentUserData = null;
let unsubscribeMessages = null;

// --- SIGN UP ---
window.signUp = async () => {
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const username = signupUsername.value.trim();
  const profilePicURL = signupProfilePic.value.trim() || "https://via.placeholder.com/100";

  if (!email || !password || !username) {
    alert("Email, password and username are required.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;

    // Save profile data to Firestore
    await setDoc(doc(db, "users", currentUser.uid), {
      username,
      email,
      profilePicURL,
      banned: false,
      followers: [],
      following: []
    });

    alert("Sign up successful!");
  } catch (e) {
    alert("Error signing up: " + e.message);
  }
};

// --- LOGIN ---
window.login = async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    alert("Email and password required.");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
  } catch (e) {
    alert("Error logging in: " + e.message);
  }
};

// --- GOOGLE LOGIN ---
window.googleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;

    // Check if user doc exists, if not create
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      await setDoc(userDocRef, {
        username: currentUser.displayName || "googleUser",
        email: currentUser.email,
        profilePicURL: currentUser.photoURL || "https://via.placeholder.com/100",
        banned: false,
        followers: [],
        following: []
      });
    }
  } catch (e) {
    alert("Google login error: " + e.message);
  }
};

// --- LOGOUT ---
window.logout = async () => {
  if (unsubscribeMessages) unsubscribeMessages();
  await signOut(auth);
  currentUser = null;
  currentUserData = null;
  authSection.classList.remove("hidden");
  profileSection.classList.add("hidden");
  postSection.classList.add("hidden");
  feedSection.classList.add("hidden");
  chatSection.classList.add("hidden");
  feed.innerHTML = "";
  chatMessages.innerHTML = "";
  alert("Logged out.");
};

// --- UPDATE PROFILE ---
window.updateProfile = async () => {
  const newUsername = prompt("Enter new username:", currentUserData.username);
  if (!newUsername) return alert("Username cannot be empty.");

  const newProfilePicURL = prompt("Enter new profile picture URL:", currentUserData.profilePicURL) || currentUserData.profilePicURL;

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      username: newUsername,
      profilePicURL: newProfilePicURL
    });
    alert("Profile updated!");
  } catch (e) {
    alert("Error updating profile: " + e.message);
  }
};

// --- POST SUBMISSION ---
window.submitPost = async () => {
  if (!currentUser) return alert("You must be logged in.");

  const content = postInput.value.trim();
  if (!content) return alert("Post cannot be empty.");

  try {
    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      username: currentUserData.username,
      profilePicURL: currentUserData.profilePicURL,
      content,
      timestamp: serverTimestamp()
    });
    postInput.value = "";
  } catch (e) {
    alert("Error posting: " + e.message);
  }
};

// --- RENDER POSTS ---
function renderPost(post) {
  const div = document.createElement("div");
  div.className = "post";

  div.innerHTML = `
    <div class="post-header">
      <img src="${post.profilePicURL}" alt="pfp">
      <strong>${post.username}</strong> <small>${new Date(post.timestamp?.toDate()).toLocaleString()}</small>
    </div>
    <div class="post-content">${post.content}</div>
  `;

  return div;
}

// --- LOAD FEED ---
function listenToFeed() {
  const postsRef = collection(db, "posts");
  const q = query(postsRef, orderBy("timestamp", "desc"));

  onSnapshot(q, (snapshot) => {
    feed.innerHTML = "";
    snapshot.forEach(doc => {
      const post = doc.data();
      feed.appendChild(renderPost(post));
    });
  });
}

// --- DM SYSTEM ---

// Send DM by username
window.sendMessage = async () => {
  if (!currentUser) return alert("You must be logged in.");

  const toUsername = chatUserInput.value.trim();
  const messageText = chatInput.value.trim();
  if (!toUsername || !messageText) return alert("Recipient username and message cannot be empty.");

  // Find receiver UID
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", toUsername));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return alert("User not found.");
  }

  const receiverDoc = querySnapshot.docs[0];
  const receiverUid = receiverDoc.id;

  try {
    await addDoc(collection(db, "messages"), {
      senderUid: currentUser.uid,
      receiverUid,
      message: messageText,
      timestamp: serverTimestamp()
    });
    chatInput.value = "";
  } catch (e) {
    alert("Error sending message: " + e.message);
  }
};

// Listen for messages between current user and the chat user
function listenToMessagesWithUsername(username) {
  if (unsubscribeMessages) unsubscribeMessages();

  // Find chat user UID
  getDocs(query(collection(db, "users"), where("username", "==", username))).then(snapshot => {
    if (snapshot.empty) {
      alert("User not found");
      return;
    }
    const chatUserDoc = snapshot.docs[0];
    const chatUserUid = chatUserDoc.id;

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("senderUid", "in", [currentUser.uid, chatUserUid]),
      orderBy("timestamp", "asc")
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
      chatMessages.innerHTML = "";
      snapshot.forEach(doc => {
        const msg = doc.data();
        // Only show messages between these two users
        if (
          (msg.senderUid === currentUser.uid && msg.receiverUid === chatUserUid) ||
          (msg.senderUid === chatUserUid && msg.receiverUid === currentUser.uid)
        ) {
          const div = document.createElement("div");
          div.textContent = (msg.senderUid === currentUser.uid ? "You: " : username + ": ") + msg.message;
          chatMessages.appendChild(div);
        }
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  });
}

// When chat user input loses focus, listen to new conversation
chatUserInput.addEventListener("change", (e) => {
  const username = e.target.value.trim();
  if (username) listenToMessagesWithUsername(username);
});

// --- BAN CHECK on login ---
async function checkBan(uid) {
  const userDocRef = doc(db, "users", uid);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) return false;

  const data = userSnap.data();
  if (data.banned) {
    alert("You are banned from this app.");
    await signOut(auth);
    return true;
  }
  return false;
}

// --- ADMIN BAN FUNCTION (example usage) ---
window.banUser = async (username) => {
  if (!currentUser) return alert("Must be logged in as admin.");

  // For demo, anyone logged in can ban — restrict in real app
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return alert("User not found.");

  const userDoc = querySnapshot.docs[0];
  await updateDoc(doc(db, "users", userDoc.id), {
    banned: true
  });

  alert(username + " has been banned.");
};

// --- AUTH STATE LISTENER ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const banned = await checkBan(user.uid);
    if (banned) return;

    currentUser = user;
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    currentUserData = userSnap.data();

    authSection.classList.add("hidden");
    profileSection.classList.remove("hidden");
    postSection.classList.remove("hidden");
    feedSection.classList.remove("hidden");
    chatSection.classList.remove("hidden");

    profileUsername.textContent = currentUserData.username;
    profileEmail.textContent = currentUser.email;
    profilePic.src = currentUserData.profilePicURL;
    followerCount.textContent = currentUserData.followers?.length || 0;
    followingCount.textContent = currentUserData.following?.length || 0;

    listenToFeed();

  } else {
    currentUser = null;
    currentUserData = null;
    authSection.classList.remove("hidden");
    profileSection.classList.add("hidden");
    postSection.classList.add("hidden");
    feedSection.classList.add("hidden");
    chatSection.classList.add("hidden");
    feed.innerHTML = "";
    chatMessages.innerHTML = "";
  }
});

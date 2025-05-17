// barbed-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

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

const authSection = document.getElementById("auth-section");
const profileSection = document.getElementById("profile-section");
const postSection = document.getElementById("post-section");
const feedSection = document.getElementById("feed");
const chatSection = document.getElementById("chat-section");

const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const signupUsernameInput = document.getElementById("signup-username");
const signupProfilePicFile = document.getElementById("signup-profile-pic-file");
const profilePicPreview = document.getElementById("profile-pic-preview");

const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");

const profileUsername = document.getElementById("profile-username");
const profilePic = document.getElementById("profile-pic");
const profileEmail = document.getElementById("profile-email");

const followerCount = document.getElementById("follower-count");
const followingCount = document.getElementById("following-count");

const postInput = document.getElementById("post-input");
const feedDiv = feedSection;

let currentUserData = null;

// --- Preview profile pic on signup ---
signupProfilePicFile.addEventListener("change", () => {
  const file = signupProfilePicFile.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    profilePicPreview.src = url;
    profilePicPreview.classList.remove("hidden");
  } else {
    profilePicPreview.src = "";
    profilePicPreview.classList.add("hidden");
  }
});

// --- Sign up ---
document.getElementById("signup-btn").addEventListener("click", async () => {
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  const username = signupUsernameInput.value.trim();

  if (!email || !password || !username) {
    alert("Please fill out all sign up fields.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Upload profile pic if provided
    let photoURL = "";
    if (signupProfilePicFile.files[0]) {
      const file = signupProfilePicFile.files[0];
      const storageRef = ref(storage, `profilePics/${user.uid}`);
      await uploadBytes(storageRef, file);
      photoURL = await getDownloadURL(storageRef);
    }

    // Update user profile (displayName and photoURL)
    await updateProfile(user, {
      displayName: username,
      photoURL: photoURL || "",
    });

    // Save user data to Firestore
    await setDoc(doc(db, "users", user.uid), {
      email,
      username,
      photoURL: photoURL || "",
      followers: [],
      following: [],
      createdAt: Date.now(),
    });

    alert("Sign up successful! You are now logged in.");
    clearSignupForm();

  } catch (error) {
    alert("Sign up error: " + error.message);
  }
});

// --- Login ---
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  if (!email || !password) {
    alert("Please enter email and password to login.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    clearLoginForm();
  } catch (error) {
    alert("Login error: " + error.message);
  }
});

// --- Google Sign-In ---
document.getElementById("google-signin-btn").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user document exists
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // New user: create Firestore document
      await setDoc(userDocRef, {
        email: user.email,
        username: user.displayName || "GoogleUser",
        photoURL: user.photoURL || "",
        followers: [],
        following: [],
        createdAt: Date.now(),
      });
    }

  } catch (error) {
    alert("Google sign-in error: " + error.message);
  }
});

// --- Logout ---
document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth);
});

// --- On Auth State Changed ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is logged in
    authSection.classList.add("hidden");
    profileSection.classList.remove("hidden");
    postSection.classList.remove("hidden");
    feedSection.classList.remove("hidden");
    chatSection.classList.remove("hidden");

    // Load user data from Firestore
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      currentUserData = userDocSnap.data();

      profileUsername.textContent = currentUserData.username || user.displayName || "User";
      profileEmail.textContent = user.email;

      profilePic.src = currentUserData.photoURL || user.photoURL || "https://via.placeholder.com/100";

      followerCount.textContent = currentUserData.followers?.length || 0;
      followingCount.textContent = currentUserData.following?.length || 0;
    } else {
      // No Firestore data, fallback:
      profileUsername.textContent = user.displayName || "User";
      profileEmail.textContent = user.email;
      profilePic.src = user.photoURL || "https://via.placeholder.com/100";
      followerCount.textContent = "0";
      followingCount.textContent = "0";
    }

    loadFeed();

  } else {
    // User logged out
    authSection.classList.remove("hidden");
    profileSection.classList.add("hidden");
    postSection.classList.add("hidden");
    feedSection.classList.add("hidden");
    chatSection.classList.add("hidden");

    profileUsername.textContent = "";
    profileEmail.textContent = "";
    profilePic.src = "";
    followerCount.textContent = "0";
    followingCount.textContent = "0";
    feedDiv.innerHTML = "";
  }
});

// --- Clear signup form ---
function clearSignupForm() {
  signupEmailInput.value = "";
  signupPasswordInput.value = "";
  signupUsernameInput.value = "";
  signupProfilePicFile.value = "";
  profilePicPreview.src = "";
  profilePicPreview.classList.add("hidden");
}

// --- Clear login form ---
function clearLoginForm() {
  loginEmailInput.value = "";
  loginPasswordInput.value = "";
}

// --- Posting ---
document.getElementById("post-btn").addEventListener("click", async () => {
  const text = postInput.value.trim();
  if (!text) return alert("Post cannot be empty!");

  if (!auth.currentUser) {
    alert("You must be logged in to post.");
    return;
  }

  try {
    await addDoc(collection(db, "posts"), {
      uid: auth.currentUser.uid,
      username: currentUserData?.username || auth.currentUser.displayName || "User",
      photoURL: currentUserData?.photoURL || auth.currentUser.photoURL || "",
      text,
      createdAt: Date.now(),
      comments: [],
      likes: [],
    });
    postInput.value = "";
  } catch (e) {
    alert("Error posting: " + e.message);
  }
});

// --- Load feed ---
function loadFeed() {
  const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));

  onSnapshot(postsQuery, (snapshot) => {
    feedDiv.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const post = docSnap.data();
      const postId = docSnap.id;

      const postEl = document.createElement("div");
      postEl.classList.add("post");

      postEl.innerHTML = `
        <div class="post-header">
          <img src="${post.photoURL || "https://via.placeholder.com/40"}" alt="Profile Pic" />
          <strong>${post.username}</strong>
        </div>
        <div class="post-content">${escapeHtml(post.text)}</div>
      `;

      feedDiv.appendChild(postEl);
    });
  });
}

// --- Utility to escape HTML to prevent injection ---
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --- Chat placeholders ---
const chatUserInput = document.getElementById("chat-user-username");
const chatMessagesDiv = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");

chatSendBtn.addEventListener("click", () => {
  const toUsername = chatUserInput.value.trim();
  const message = chatInput.value.trim();
  if (!toUsername || !message) {
    alert("Enter username and message.");
    return;
  }

  // For now, just a placeholder alert.
  alert(`Would send message to ${toUsername}: ${message}`);
  chatInput.value = "";
});

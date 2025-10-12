// auth-listener.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (window.location.pathname.includes("login.html")) {
      window.location.href = "index.html";
    }
  } else {
    if (window.location.pathname.includes("index.html")) {
      window.location.href = "login.html";
    }
  }
});

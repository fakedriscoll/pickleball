// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBDOZBWIINdAHkEW7t3IymNNEkiJfvbeOA",
  authDomain: "pickleball-f03ab.firebaseapp.com",
  databaseURL: "https://pickleball-f03ab-default-rtdb.firebaseio.com/",
  projectId: "pickleball-f03ab",
  storageBucket: "pickleball-f03ab.firebasestorage.app",
  messagingSenderId: "655138234475",
  appId: "1:655138234475:web:0cd20d9852a13005d8912e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig );
// Remova 'const' aqui para torná-los globais
database = firebase.database();
auth = firebase.auth();
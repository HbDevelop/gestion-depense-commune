// Config du projet Firebase "gestion-depense-commune" (console.firebase.google.com).
// Ces clés sont publiques par design (elles identifient juste le projet, elles n'autorisent rien
// en elles-mêmes) : la vraie sécurité vient des règles Firestore (voir README.md) qui limitent
// la lecture/écriture aux comptes autorisés ci-dessous.
export const firebaseConfig = {
  apiKey: "AIzaSyA6rLibk_QOoOm_Fzpkw-w9X3m6hQGNs-o",
  authDomain: "gestion-depense-commune.firebaseapp.com",
  projectId: "gestion-depense-commune",
  storageBucket: "gestion-depense-commune.firebasestorage.app",
  messagingSenderId: "934779108764",
  appId: "1:934779108764:web:3438c60e8f15f56fa99c59"
};

// Doit rester identique aux emails autorisés dans les règles Firestore.
export const AUTHORIZED_EMAILS = [
  "boudriga.habib@gmail.com",
  "boudriga.sarah@gmail.com",
  "yosra_boudriga@yahoo.fr"
];

// ID client OAuth Web du provider Google (Firebase Auth > Sign-in method > Google >
// Configuration du SDK Web). Utilisé par Google Identity Services pour la connexion :
// on évite ainsi le relais par iframe tierce de Firebase, souvent bloqué par les
// navigateurs qui restreignent le stockage/cookies tiers.
export const GOOGLE_CLIENT_ID = "934779108764-13eetjam5laa4blbmh40p2cqkqatu8j8.apps.googleusercontent.com";

import { firebaseConfig, AUTHORIZED_EMAILS, GOOGLE_CLIENT_ID } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot,
  query, orderBy, arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PEOPLE = ["Sarah", "Habib", "Yosra"];
const DEFAULT_RATE = 3.37; // 1 EUR = X TND, remplacé par la valeur stockée dans meta/rates dès le chargement

// ---- State ----
let currentUser = null;
let expenses = [];
let rate = DEFAULT_RATE;
let unsubExpenses = null;
let unsubRate = null;

// ---- DOM ----
const $ = (sel) => document.querySelector(sel);
const loginScreen = $("#login-screen");
const deniedScreen = $("#denied-screen");
const appShell = $("#app-shell");
const googleButtonContainer = $("#google-signin-button");
const logoutBtn = $("#logout-btn");
const deniedLogoutBtn = $("#denied-logout-btn");
const userLabel = $("#user-label");
const emailLinkForm = $("#email-link-form");
const emailLinkInput = $("#email-link-input");
const emailLinkStatus = $("#email-link-status");
const rateInput = $("#rate-input");
const rateStatus = $("#rate-status");
const balancesSummary = $("#balances-summary");
const settlementsList = $("#settlements-list");
const expenseForm = $("#expense-form");
const expensesTbody = $("#expenses-tbody");
const expensesCount = $("#expenses-count");

function euros(n) {
  return (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function tnd(n) {
  return (n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TND";
}

// ---- Auth : Google Identity Services ----
// On utilise Google Identity Services (le bouton "Sign in with Google" de Google) plutôt que
// signInWithPopup/signInWithRedirect de Firebase : ces derniers dépendent d'une iframe tierce
// sur le domaine firebaseapp.com que les navigateurs modernes bloquent de plus en plus.
function handleGoogleCredential(response) {
  const credential = GoogleAuthProvider.credential(response.credential);
  signInWithCredential(auth, credential).catch((e) => {
    alert("Connexion impossible : " + e.message);
  });
}

function initGoogleSignIn() {
  if (!window.google?.accounts?.id) {
    setTimeout(initGoogleSignIn, 100);
    return;
  }
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
  google.accounts.id.renderButton(googleButtonContainer, {
    theme: "outline", size: "large", text: "signin_with", locale: "fr", width: 280
  });
}
initGoogleSignIn();

// ---- Auth : lien email (fallback pour les comptes non-Google, ex. Yahoo) ----
const actionCodeSettings = {
  url: window.location.href.split("#")[0].split("?")[0],
  handleCodeInApp: true
};

emailLinkForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailLinkInput.value.trim().toLowerCase();
  if (!AUTHORIZED_EMAILS.includes(email)) {
    emailLinkStatus.textContent = "Cette adresse n'est pas autorisée.";
    return;
  }
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    emailLinkStatus.textContent = "Lien envoyé ! Vérifie ta boîte mail (et les spams).";
  } catch (err) {
    emailLinkStatus.textContent = "Erreur : " + err.message;
  }
});

async function completeEmailLinkSignInIfNeeded() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;
  let email = window.localStorage.getItem("emailForSignIn");
  if (!email) email = window.prompt("Confirme ton email pour terminer la connexion :");
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem("emailForSignIn");
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (err) {
    alert("Connexion impossible : " + err.message);
  }
}
completeEmailLinkSignInIfNeeded();

logoutBtn.addEventListener("click", () => signOut(auth));
deniedLogoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  loginScreen.classList.add("hidden");
  deniedScreen.classList.add("hidden");
  appShell.classList.add("hidden");
  if (unsubExpenses) { unsubExpenses(); unsubExpenses = null; }
  if (unsubRate) { unsubRate(); unsubRate = null; }

  if (!user) {
    loginScreen.classList.remove("hidden");
    return;
  }
  if (!AUTHORIZED_EMAILS.includes(user.email)) {
    deniedScreen.classList.remove("hidden");
    $("#denied-email").textContent = user.email;
    return;
  }
  userLabel.textContent = user.email;
  appShell.classList.remove("hidden");
  startListeners();
});

// ---- Firestore listeners (temps réel, comme un sheet partagé) ----
function startListeners() {
  unsubRate = onSnapshot(doc(db, "meta", "rates"), (snap) => {
    rate = snap.exists() && snap.data().eurToTnd ? snap.data().eurToTnd : DEFAULT_RATE;
    rateInput.value = rate;
    renderAll();
  });

  const q = query(collection(db, "expenses"), orderBy("date", "desc"));
  unsubExpenses = onSnapshot(q, (snap) => {
    expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

rateInput.addEventListener("change", async () => {
  const v = parseFloat(rateInput.value);
  if (!v || v <= 0) return;
  rateStatus.textContent = "Enregistrement…";
  await setDoc(doc(db, "meta", "rates"), { eurToTnd: v }, { merge: true });
  rateStatus.textContent = "Enregistré";
  setTimeout(() => { rateStatus.textContent = ""; }, 1500);
});

// ---- Calculs ----
function valeurEUR(exp) {
  return exp.devise === "TND" ? exp.montant / rate : exp.montant;
}

function partParPersonne(exp) {
  const n = (exp.concerns || []).length;
  return n > 0 ? valeurEUR(exp) / n : 0;
}

function computeBalances() {
  const balances = {};
  PEOPLE.forEach((p) => { balances[p] = { paye: 0, du: 0 }; });
  expenses.forEach((exp) => {
    const v = valeurEUR(exp);
    if (balances[exp.payeur]) balances[exp.payeur].paye += v;
    const part = partParPersonne(exp);
    (exp.concerns || []).forEach((p) => {
      if (balances[p]) balances[p].du += part;
    });
  });
  PEOPLE.forEach((p) => { balances[p].solde = balances[p].paye - balances[p].du; });
  return balances;
}

function computeSettlements(balances) {
  const creditors = PEOPLE.filter((p) => balances[p].solde > 0.01)
    .map((p) => ({ name: p, amount: balances[p].solde })).sort((a, b) => b.amount - a.amount);
  const debtors = PEOPLE.filter((p) => balances[p].solde < -0.01)
    .map((p) => ({ name: p, amount: -balances[p].solde })).sort((a, b) => b.amount - a.amount);
  const result = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amount, creditors[j].amount);
    result.push({ from: debtors[i].name, to: creditors[j].name, amount: amt });
    debtors[i].amount -= amt;
    creditors[j].amount -= amt;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }
  return result;
}

// ---- Rendu ----
function renderAll() {
  const balances = computeBalances();
  renderBalances(balances);
  renderSettlements(computeSettlements(balances));
  renderExpensesTable();
}

function renderBalances(balances) {
  balancesSummary.innerHTML = "";
  PEOPLE.forEach((p) => {
    const b = balances[p];
    const statut = b.solde > 0.01 ? "À recevoir" : b.solde < -0.01 ? "À payer" : "Équilibré";
    const cls = b.solde > 0.01 ? "positive" : b.solde < -0.01 ? "negative" : "";
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <span class="name">${p}</span>
      <span class="line">
        <span>Payé</span>
        <span class="amount-stack"><span class="amount-eur">${euros(b.paye)}</span><span class="amount-tnd">${tnd(b.paye * rate)}</span></span>
      </span>
      <span class="line">
        <span>Dû</span>
        <span class="amount-stack"><span class="amount-eur">${euros(b.du)}</span><span class="amount-tnd">${tnd(b.du * rate)}</span></span>
      </span>
      <span class="solde ${cls}">${euros(b.solde)}</span>
      <span class="solde-tnd ${cls}">${tnd(b.solde * rate)}</span>
      <span class="statut">${statut}</span>
    `;
    balancesSummary.appendChild(card);
  });
}

function renderSettlements(settlements) {
  settlementsList.innerHTML = "";
  if (settlements.length === 0) {
    settlementsList.innerHTML = '<p class="settlements-empty">Tout est équilibré 🎉</p>';
    return;
  }
  settlements.forEach((s) => {
    const row = document.createElement("div");
    row.className = "settlement-item";
    row.innerHTML = `
      <span>${s.from} → ${s.to}</span>
      <span class="amount-stack"><span class="amount-eur">${euros(s.amount)}</span><span class="amount-tnd">${tnd(s.amount * rate)}</span></span>
    `;
    settlementsList.appendChild(row);
  });
}

function renderExpensesTable() {
  expensesCount.textContent = `${expenses.length} dépense${expenses.length > 1 ? "s" : ""}`;
  expensesTbody.innerHTML = "";
  expenses.forEach((exp) => {
    const tr = document.createElement("tr");
    const ref = doc(db, "expenses", exp.id);

    const tdDate = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = exp.date || "";
    dateInput.addEventListener("change", () => updateDoc(ref, { date: dateInput.value }));
    tdDate.appendChild(dateInput);

    const tdDesc = document.createElement("td");
    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.value = exp.description || "";
    descInput.title = exp.description || "";
    descInput.addEventListener("change", () => updateDoc(ref, { description: descInput.value }));
    descInput.addEventListener("input", () => { descInput.title = descInput.value; });
    tdDesc.appendChild(descInput);

    const tdPayeur = document.createElement("td");
    const payeurSelect = document.createElement("select");
    PEOPLE.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p; opt.textContent = p;
      if (p === exp.payeur) opt.selected = true;
      payeurSelect.appendChild(opt);
    });
    payeurSelect.addEventListener("change", () => updateDoc(ref, { payeur: payeurSelect.value }));
    tdPayeur.appendChild(payeurSelect);

    const tdMontant = document.createElement("td");
    const montantInput = document.createElement("input");
    montantInput.type = "number";
    montantInput.step = "0.01";
    montantInput.min = "0";
    montantInput.value = exp.montant;
    montantInput.addEventListener("change", () => updateDoc(ref, { montant: parseFloat(montantInput.value) || 0 }));
    tdMontant.appendChild(montantInput);

    const tdDevise = document.createElement("td");
    const deviseSelect = document.createElement("select");
    ["EUR", "TND"].forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d;
      if (d === exp.devise) opt.selected = true;
      deviseSelect.appendChild(opt);
    });
    deviseSelect.addEventListener("change", () => updateDoc(ref, { devise: deviseSelect.value }));
    tdDevise.appendChild(deviseSelect);

    const tdConcerns = document.createElement("td");
    const concernsWrap = document.createElement("div");
    concernsWrap.className = "concerns-badges";
    const concernCheckboxes = [];
    PEOPLE.forEach((p) => {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (exp.concerns || []).includes(p);
      cb.addEventListener("change", () => {
        // Une dépense doit toujours concerner au moins une personne : sinon son montant
        // reste compté dans le "payé" du payeur sans jamais être réparti dans un "dû",
        // créant un solde fantôme que l'algorithme d'équilibre ne peut pas rattraper.
        if (!cb.checked && concernCheckboxes.every((other) => !other.checked)) {
          cb.checked = true;
          alert("Une dépense doit concerner au moins une personne.");
          return;
        }
        updateDoc(ref, { concerns: cb.checked ? arrayUnion(p) : arrayRemove(p) });
      });
      concernCheckboxes.push(cb);
      label.appendChild(cb);
      label.append(p[0]);
      concernsWrap.appendChild(label);
    });
    tdConcerns.appendChild(concernsWrap);

    const tdValeurEUR = document.createElement("td");
    tdValeurEUR.textContent = euros(valeurEUR(exp));

    const tdPart = document.createElement("td");
    tdPart.textContent = euros(partParPersonne(exp));

    const tdActions = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "✕";
    delBtn.title = "Supprimer";
    delBtn.addEventListener("click", () => {
      if (confirm("Supprimer cette dépense ?")) deleteDoc(ref);
    });
    tdActions.appendChild(delBtn);

    tr.append(tdDate, tdDesc, tdPayeur, tdMontant, tdDevise, tdConcerns, tdValeurEUR, tdPart, tdActions);
    expensesTbody.appendChild(tr);
  });
}

// ---- Ajout d'une dépense ----
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const concerns = Array.from(document.querySelectorAll(".f-concerne:checked")).map((c) => c.value);
  if (concerns.length === 0) {
    alert("Une dépense doit concerner au moins une personne.");
    return;
  }
  const payload = {
    date: $("#f-date").value,
    description: $("#f-description").value.trim(),
    payeur: $("#f-payeur").value,
    montant: parseFloat($("#f-montant").value) || 0,
    devise: $("#f-devise").value,
    concerns,
    createdAt: serverTimestamp(),
    createdBy: currentUser?.email || null
  };
  await addDoc(collection(db, "expenses"), payload);
  expenseForm.reset();
  document.querySelectorAll(".f-concerne").forEach((c) => { c.checked = true; });
  $("#f-date").value = new Date().toISOString().slice(0, 10);
});

$("#f-date").value = new Date().toISOString().slice(0, 10);

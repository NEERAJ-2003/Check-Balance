(() => {
  const LS = {
    users: "cb_users_v1",
    session: "cb_session_v1",
    dataKey: (userId) => `cb_data_v1_${userId}`,
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    desktopBlock: $("desktopBlock"),
    brandSub: $("brandSub"),
    appShell: $("appShell"),

    viewAuth: $("viewAuth"),
    viewApp: $("viewApp"),

    authTabs: $("authTabs"),

    tabLogin: $("tabLogin"),
    tabSignup: $("tabSignup"),
    loginForm: $("loginForm"),
    signupForm: $("signupForm"),

    loginUsername: $("loginUsername"),
    loginPassword: $("loginPassword"),

    forgotToggleBtn: $("forgotToggleBtn"),
    forgotForm: $("forgotForm"),
    forgotBackBtn: $("forgotBackBtn"),
    forgotUsername: $("forgotUsername"),
    forgotPassword: $("forgotPassword"),
    forgotConfirm: $("forgotConfirm"),

    signupUsername: $("signupUsername"),
    signupPassword: $("signupPassword"),
    signupConfirm: $("signupConfirm"),
    signupInitial: $("signupInitial"),

    logoutBtn: $("logoutBtn"),

    navHome: $("navHome"),
    navAdd: $("navAdd"),
    navSettings: $("navSettings"),

    panelHome: $("panelHome"),
    panelAdd: $("panelAdd"),
    panelSettings: $("panelSettings"),

    balanceValue: $("balanceValue"),
    creditValue: $("creditValue"),
    debitValue: $("debitValue"),

    emptyState: $("emptyState"),
    txList: $("txList"),

    typeCredit: $("typeCredit"),
    typeDebit: $("typeDebit"),
    txTypeTabs: $("txTypeTabs"),
    txForm: $("txForm"),
    txAmount: $("txAmount"),
    txNote: $("txNote"),
    txSubmitBtn: $("txSubmitBtn"),

    settingsForm: $("settingsForm"),
    initialInput: $("initialInput"),
    initialHelp: $("initialHelp"),
    saveInitialBtn: $("saveInitialBtn"),
    wipeBtn: $("wipeBtn"),

    toast: $("toast"),

    modalOverlay: $("modalOverlay"),
    modalTitle: $("modalTitle"),
    modalDesc: $("modalDesc"),
    modalCancel: $("modalCancel"),
    modalConfirm: $("modalConfirm"),
  };

  /** @type {{user: {id:string,username:string} | null, data: {initialBalance:number, initialLocked:boolean, transactions:any[]}}} */
  const state = {
    user: null,
    data: { initialBalance: 0, initialLocked: false, transactions: [] },
  };

  let currentPanel = "home";
  let currentTxType = "credit";

  const readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const writeJSON = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const uid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const normalizeUsername = (name) => String(name || "").trim().toLowerCase();

  const formatMoney = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "0.00";
    return num.toFixed(2);
  };

  const formatWhen = (ms) => {
    const d = new Date(ms);
    const dd = d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
    const tt = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${dd} · ${tt}`;
  };

  const toast = (message) => {
    els.toast.textContent = message;
    els.toast.classList.add("isOn");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => els.toast.classList.remove("isOn"), 2600);
  };

  const openModal = ({ title, desc, confirmText = "Delete", confirmTone = "danger", onConfirm }) => {
    els.modalTitle.textContent = title;
    els.modalDesc.textContent = desc;
    els.modalConfirm.textContent = confirmText;
    els.modalConfirm.classList.remove("dangerBtn", "primaryBtn");
    els.modalConfirm.classList.add(confirmTone === "primary" ? "primaryBtn" : "dangerBtn");
    els.modalOverlay.classList.remove("isHidden");
    els.modalOverlay.setAttribute("aria-hidden", "false");

    const cleanup = () => {
      els.modalOverlay.classList.add("isHidden");
      els.modalOverlay.setAttribute("aria-hidden", "true");
      els.modalConfirm.onclick = null;
      els.modalCancel.onclick = null;
      els.modalOverlay.onclick = null;
      document.removeEventListener("keydown", onEsc);
    };

    const onEsc = (e) => {
      if (e.key === "Escape") cleanup();
    };

    els.modalCancel.onclick = () => cleanup();
    els.modalOverlay.onclick = (e) => {
      if (e.target === els.modalOverlay) cleanup();
    };
    els.modalConfirm.onclick = () => {
      cleanup();
      onConfirm?.();
    };
    document.addEventListener("keydown", onEsc);
  };

  const getUsers = () => readJSON(LS.users, []);
  const setUsers = (users) => writeJSON(LS.users, users);

  const getSession = () => readJSON(LS.session, null);
  const setSession = (session) => writeJSON(LS.session, session);
  const clearSession = () => localStorage.removeItem(LS.session);

  const loadUserData = (userId) => {
    const data = readJSON(LS.dataKey(userId), null);
    if (!data || typeof data.initialBalance !== "number" || !Array.isArray(data.transactions)) {
      return { initialBalance: 0, initialLocked: false, transactions: [] };
    }
    return {
      initialBalance: data.initialBalance,
      transactions: data.transactions,
      // If older data exists without this flag, treat it as locked (no further edits)
      initialLocked: typeof data.initialLocked === "boolean" ? data.initialLocked : true,
    };
  };

  const saveUserData = () => {
    if (!state.user) return;
    writeJSON(LS.dataKey(state.user.id), state.data);
  };

  const syncInitialLockUI = () => {
    const locked = !!state.data.initialLocked;
    if (els.initialInput) els.initialInput.disabled = locked;
    if (els.saveInitialBtn) els.saveInitialBtn.disabled = locked;
    if (els.initialHelp) {
      els.initialHelp.textContent = locked
        ? "Initial balance is locked and cannot be changed."
        : "This changes the starting balance for calculations.";
    }
  };

  const computeTotals = () => {
    const initial = Number(state.data.initialBalance) || 0;
    let credits = 0;
    let debits = 0;
    for (const t of state.data.transactions) {
      const amt = Number(t.amount) || 0;
      if (t.type === "credit") credits += amt;
      if (t.type === "debit") debits += amt;
    }
    const balance = initial + credits - debits;
    return { initial, credits, debits, balance };
  };

  const render = () => {
    const { initial, credits, debits, balance } = computeTotals();

    els.balanceValue.textContent = formatMoney(balance);
    els.creditValue.textContent = `+${formatMoney(credits)}`;
    els.debitValue.textContent =
      debits === 0 ? formatMoney(0) : `-${formatMoney(debits)}`;

    if (els.brandSub) {
      els.brandSub.textContent = state.user
        ? `Hi @${state.user.username}`
        : "Securely stored on your device";
    }

    const txs = [...state.data.transactions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    els.txList.innerHTML = "";
    els.emptyState.classList.toggle("isHidden", txs.length > 0);

    for (const tx of txs) {
      const li = document.createElement("li");
      li.className = "txItem";

      const left = document.createElement("div");
      left.className = "txLeft";

      const row = document.createElement("div");
      row.className = "txTypeRow";

      const badge = document.createElement("span");
      badge.className = `badge ${tx.type}`;
      badge.textContent = tx.type === "credit" ? "CREDIT" : "DEBIT";

      const note = document.createElement("div");
      note.className = "txNote";
      note.textContent = String(tx.note || "").trim() || "(No note)";

      row.appendChild(badge);
      row.appendChild(note);

      const time = document.createElement("div");
      time.className = "txTime";
      time.textContent = formatWhen(tx.createdAt || Date.now());

      left.appendChild(row);
      left.appendChild(time);

      const right = document.createElement("div");
      right.className = "txRight";

      const amt = document.createElement("div");
      amt.className = `txAmt ${tx.type}`;
      amt.textContent = `${tx.type === "credit" ? "+" : "-"}${formatMoney(tx.amount)}`;

      const del = document.createElement("button");
      del.className = "txDel";
      del.type = "button";
      del.setAttribute("aria-label", "Delete transaction");
      del.textContent = "×";
      del.onclick = () => confirmDeleteTx(tx.id);

      right.appendChild(amt);
      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);
      els.txList.appendChild(li);
    }
  };

  const setPanel = (next) => {
    currentPanel = next;
    const isHome = next === "home";
    const isAdd = next === "add";
    const isSettings = next === "settings";

    els.panelHome.classList.toggle("isActive", isHome);
    els.panelAdd.classList.toggle("isActive", isAdd);
    els.panelSettings.classList.toggle("isActive", isSettings);

    els.navHome.classList.toggle("isActive", isHome);
    els.navAdd.classList.toggle("isActive", isAdd);
    els.navSettings.classList.toggle("isActive", isSettings);
  };

  const setTxType = (type) => {
    currentTxType = type;
    const isCredit = type === "credit";
    els.typeCredit.classList.toggle("isActive", isCredit);
    els.typeDebit.classList.toggle("isActive", !isCredit);
    els.typeCredit.setAttribute("aria-selected", String(isCredit));
    els.typeDebit.setAttribute("aria-selected", String(!isCredit));
    if (els.txTypeTabs) {
      els.txTypeTabs.dataset.type = isCredit ? "credit" : "debit";
    }
    els.txSubmitBtn.textContent = isCredit ? "Credit amount" : "Debit amount";
  };

  const showAuth = () => {
    els.viewAuth.classList.remove("isHidden");
    els.viewApp.classList.add("isHidden");
    els.logoutBtn.hidden = true;
    els.logoutBtn.style.display = "none";
    state.user = null;
    state.data = { initialBalance: 0, initialLocked: false, transactions: [] };
    currentPanel = "home";
    setPanel("home");
    syncInitialLockUI();
  };

  const showApp = () => {
    els.viewAuth.classList.add("isHidden");
    els.viewApp.classList.remove("isHidden");
    els.logoutBtn.hidden = false;
    els.logoutBtn.style.display = "";
    setPanel("home");
    render();
  };

  const login = (user) => {
    state.user = { id: user.id, username: user.username || user.name || "User" };
    state.data = loadUserData(user.id);
    setSession({ userId: user.id });
    els.initialInput.value = String(state.data.initialBalance ?? 0);
    syncInitialLockUI();
    showApp();
  };

  const logout = () => {
    openModal({
      title: "Logout",
      desc: "Are you sure you want to logout?",
      confirmText: "Logout",
      confirmTone: "primary",
      onConfirm: () => {
        clearSession();
        toast("Logged out");
        showAuth();
      },
    });
  };

  const confirmDeleteTx = (txId) => {
    const tx = state.data.transactions.find((t) => t.id === txId);
    if (!tx) return;
    const label = tx.type === "credit" ? "Credit" : "Debit";
    const note = String(tx.note || "").trim();
    const desc = `Are you sure you want to delete this transaction?\n\n${label}: ${formatMoney(tx.amount)}${note ? `\nNote: ${note}` : ""}`;
    openModal({
      title: "Delete transaction",
      desc,
      confirmText: "Delete",
      confirmTone: "danger",
      onConfirm: () => {
        state.data.transactions = state.data.transactions.filter((t) => t.id !== txId);
        saveUserData();
        render();
        toast("Transaction deleted");
      },
    });
  };

  const attachEvents = () => {
    els.tabLogin.onclick = () => {
      els.tabLogin.classList.add("isActive");
      els.tabSignup.classList.remove("isActive");
      els.tabLogin.setAttribute("aria-selected", "true");
      els.tabSignup.setAttribute("aria-selected", "false");
      if (els.authTabs) els.authTabs.dataset.auth = "login";
      els.loginForm.classList.remove("isHidden");
      els.signupForm.classList.add("isHidden");
    };

    els.tabSignup.onclick = () => {
      els.tabSignup.classList.add("isActive");
      els.tabLogin.classList.remove("isActive");
      els.tabSignup.setAttribute("aria-selected", "true");
      els.tabLogin.setAttribute("aria-selected", "false");
      if (els.authTabs) els.authTabs.dataset.auth = "signup";
      els.signupForm.classList.remove("isHidden");
      els.loginForm.classList.add("isHidden");
      els.forgotForm.classList.add("isHidden");
    };

    els.loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = normalizeUsername(els.loginUsername.value);
      const password = String(els.loginPassword.value || "");

      if (!username || !password) {
        toast("Username and password are required");
        return;
      }

      const users = getUsers();
      const user = users.find(
        (u) => normalizeUsername(u.username || u.name) === username && u.password === password
      );
      if (!user) {
        toast("Invalid username or password");
        return;
      }
      login(user);
      toast("Welcome back");
    });

    els.signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = normalizeUsername(els.signupUsername.value);
      const password = String(els.signupPassword.value || "");
      const confirm = String(els.signupConfirm.value || "");
      const initial = Number(els.signupInitial.value);

      if (!username || !password || !confirm || !Number.isFinite(initial)) {
        toast("Please fill all mandatory fields");
        return;
      }
      if (password.length < 4) {
        toast("Password must be at least 4 characters");
        return;
      }
      if (password !== confirm) {
        toast("Passwords do not match");
        return;
      }
      if (initial < 0) {
        toast("Initial balance must be 0 or more");
        return;
      }

      const users = getUsers();
      if (users.some((u) => normalizeUsername(u.username || u.name) === username)) {
        toast("Username already exists. Please login.");
        els.tabLogin.click();
        return;
      }

      const user = { id: uid(), username, password };
      users.push(user);
      setUsers(users);
      writeJSON(LS.dataKey(user.id), { initialBalance: initial, initialLocked: true, transactions: [] });
      login(user);
      toast("Account created");
    });

    els.forgotToggleBtn.onclick = () => {
      els.loginForm.classList.add("isHidden");
      els.signupForm.classList.add("isHidden");
      els.forgotForm.classList.remove("isHidden");
      // retrigger smooth pop animation
      els.forgotForm.classList.remove("formPopIn");
      void els.forgotForm.offsetWidth;
      els.forgotForm.classList.add("formPopIn");
    };

    if (els.forgotBackBtn) {
      els.forgotBackBtn.onclick = () => {
        els.forgotForm.classList.add("isHidden");
        els.loginForm.classList.remove("isHidden");
        els.signupForm.classList.add("isHidden");
      };
    }

    els.forgotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = normalizeUsername(els.forgotUsername.value);
      const newPass = String(els.forgotPassword.value || "");
      const confirm = String(els.forgotConfirm.value || "");

      if (!username || !newPass || !confirm) {
        toast("Please fill all fields");
        return;
      }
      if (newPass.length < 4) {
        toast("Password must be at least 4 characters");
        return;
      }
      if (newPass !== confirm) {
        toast("Passwords do not match");
        return;
      }

      const users = getUsers();
      const idx = users.findIndex((u) => normalizeUsername(u.username || u.name) === username);
      if (idx === -1) {
        toast("No account found for this username");
        return;
      }

      openModal({
        title: "Reset password",
        desc: `Are you sure you want to reset the password for @${username}?`,
        confirmText: "Reset",
        confirmTone: "primary",
        onConfirm: () => {
          users[idx].password = newPass;
          setUsers(users);
          toast("Password reset. Please login.");
          els.forgotForm.classList.add("isHidden");
          els.forgotForm.reset();
        },
      });
    });

    els.logoutBtn.onclick = logout;

    els.navHome.onclick = () => setPanel("home");
    els.navAdd.onclick = () => setPanel("add");
    els.navSettings.onclick = () => setPanel("settings");

    els.typeCredit.onclick = () => setTxType("credit");
    els.typeDebit.onclick = () => setTxType("debit");

    els.txForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = Number(els.txAmount.value);
      const note = String(els.txNote.value || "").trim();

      if (!Number.isFinite(amount) || amount <= 0) {
        toast("Enter a valid amount");
        return;
      }

      const tx = {
        id: uid(),
        type: currentTxType,
        amount,
        note,
        createdAt: Date.now(),
      };

      const title = currentTxType === "credit" ? "Confirm credit" : "Confirm debit";
      const descLines = [
        `${currentTxType === "credit" ? "Credit" : "Debit"}: ${formatMoney(amount)}`,
        note ? `Note: ${note}` : "",
      ].filter(Boolean);

      openModal({
        title,
        desc: descLines.join("\n"),
        confirmText: currentTxType === "credit" ? "Confirm credit" : "Confirm debit",
        confirmTone: "primary",
        onConfirm: () => {
          state.data.transactions.push(tx);
          saveUserData();
          render();

          els.txAmount.value = "";
          els.txNote.value = "";
          toast(currentTxType === "credit" ? "Amount credited" : "Amount debited");

          window.setTimeout(() => setPanel("home"), 220);
        },
      });
    });

    els.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const initial = Number(els.initialInput.value);
      if (!Number.isFinite(initial) || initial < 0) {
        toast("Enter a valid initial balance");
        return;
      }
      if (state.data.initialLocked) {
        toast("Initial balance is locked");
        syncInitialLockUI();
        return;
      }

      openModal({
        title: "Save initial balance",
        desc: `Set initial balance to ${formatMoney(initial)}?`,
        confirmText: "Save",
        confirmTone: "primary",
        onConfirm: () => {
          state.data.initialBalance = initial;
          state.data.initialLocked = true;
          saveUserData();
          render();
          syncInitialLockUI();
          toast("Initial balance saved");
        },
      });
    });

    els.wipeBtn.onclick = () => {
      openModal({
        title: "Delete all transactions",
        desc: "Are you sure you want to delete all transactions?",
        confirmText: "Delete all",
        confirmTone: "danger",
        onConfirm: () => {
          state.data.transactions = [];
          saveUserData();
          render();
          toast("All transactions deleted");
        },
      });
    };

    const preventZoom = (e) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", preventZoom, { passive: false });
    document.addEventListener("gesturechange", preventZoom, { passive: false });
    document.addEventListener("gestureend", preventZoom, { passive: false });
    document.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) e.preventDefault();
      },
      { passive: false }
    );
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  };

  const boot = () => {
    attachEvents();
    setTxType("credit");

    const session = getSession();
    if (session?.userId) {
      const users = getUsers();
      const user = users.find((u) => u.id === session.userId);
      if (user) {
        login(user);
        return;
      }
      clearSession();
    }
    showAuth();
  };

  boot();
})();

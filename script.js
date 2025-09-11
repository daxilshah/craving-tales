import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const signinPanel = document.getElementById("signinPanel");
const panelSignInBtn = document.getElementById("panelSignInBtn");
const formContainer = document.getElementById("formContainer");
const signOutBtn = document.getElementById("signOutBtn");
const signOutSection = document.getElementById("signOutSection");
const userDetails = document.getElementById("userDetails");
const mainTabs = document.getElementById("main-tabs");
const tabContent = document.getElementById("tabContent");

let currentUser = null;
let ingredientsCache = [];
let menuCache = [];
let orders = [];

// --- AUTHENTICATION ---
panelSignInBtn.onclick = () => signInWithPopup(auth, provider);
signOutBtn.onclick = () => signOut(auth);

auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    signinPanel.classList.add("hidden");
    formContainer.classList.remove("hidden");
    userDetails.textContent = `Welcome, ${user.displayName || user.email}`;
    signOutSection.classList.remove("hidden");
    initializeAppUI();
  } else {
    currentUser = null;
    signinPanel.classList.remove("hidden");
    formContainer.classList.add("hidden");
    signOutSection.classList.add("hidden");
    mainTabs.innerHTML = "";
    tabContent.innerHTML = "";
  }
});

// --- UI INITIALIZATION ---
function initializeAppUI() {
  const managers = {
    Dashboard: renderDashboard,
    Orders: renderOrderManager,
    Menu: renderMenuManager,
    Ingredients: renderIngredientsManager,
  };

  mainTabs.innerHTML = "";
  tabContent.innerHTML = "";

  Object.keys(managers).forEach((name, index) => {
    // Create Tab Button
    const li = document.createElement("li");
    li.className = "mr-2";
    const button = document.createElement("button");
    button.id = `${name.toLowerCase()}-tab`;
    button.className = "tab-button";
    button.textContent = name;
    button.onclick = () => showTab(name.toLowerCase());
    li.appendChild(button);
    mainTabs.appendChild(li);

    // Create Tab Panel
    const panel = document.createElement("div");
    panel.id = `${name.toLowerCase()}-manager`;
    panel.className = "hidden tab-panel";
    tabContent.appendChild(panel);
    managers[name](panel); // Render content into the panel
  });

  showTab("dashboard"); // Show Dashboard tab by default
}

function showTab(tabName) {
  // Hide all panels and deactivate all tabs
  document
    .querySelectorAll(".tab-panel")
    .forEach((panel) => panel.classList.add("hidden"));
  document
    .querySelectorAll(".tab-button")
    .forEach((button) => button.classList.remove("active"));

  // Show the selected panel and activate the tab
  document.getElementById(`${tabName}-manager`)?.classList.remove("hidden");
  document.getElementById(`${tabName}-tab`)?.classList.add("active");
  if (tabName === "dashboard") {
    loadDashboardData();
  }
}

// --- DATA HELPERS ---
const getCollectionRef = (collectionName) =>
  collection(db, `users/${currentUser.uid}/${collectionName}`);
const getDocRef = (collectionName, id) =>
  doc(db, `users/${currentUser.uid}/${collectionName}`, id);

async function fetchData(collectionName) {
  const querySnapshot = await getDocs(getCollectionRef(collectionName));
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// --- DASHBOARD MANAGER ---
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 rounded-lg shadow-md text-center">
          <h4 class="text-xl font-semibold text-gray-500">Total Orders</h4>
          <p id="total-orders-stat" class="text-4xl font-bold mt-2">0</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md text-center">
          <h4 class="text-xl font-semibold text-gray-500">Total Revenue</h4>
          <p id="total-revenue-stat" class="text-4xl font-bold mt-2">₹0</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md text-center">
          <h4 class="text-xl font-semibold text-gray-500">Pending Orders</h4>
          <p id="pending-orders-stat" class="text-4xl font-bold mt-2">0</p>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-bold mb-4">Pending Orders List</h3>
        <div id="pending-orders-list" class="space-y-4"></div>
      </div>
      <div>
        <h3 class="text-lg font-bold mt-8 mb-4">Recent Orders</h3>
        <div id="recent-orders-list" class="space-y-4"></div>
      </div>
    </div>
  `;

  await loadDashboardData();
}

async function loadDashboardData() {
  const allOrders = await fetchData("orders");
  allOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

  // Stats
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders.reduce(
    (sum, order) => sum + (order.totalAmount || 0),
    0
  );
  const pendingOrders = allOrders.filter((order) => !order.isDelivered);
  const pendingCount = pendingOrders.length;

  document.getElementById("total-orders-stat").textContent = totalOrders;
  document.getElementById(
    "total-revenue-stat"
  ).textContent = `₹${totalRevenue.toFixed(2)}`;
  document.getElementById("pending-orders-stat").textContent = pendingCount;

  // Pending Orders List
  const pendingListContainer = document.getElementById("pending-orders-list");
  pendingListContainer.innerHTML = "";

  pendingOrders.forEach((order) => {
    const orderCard = document.createElement("div");
    orderCard.className =
      "bg-white p-4 rounded-lg shadow border cursor-pointer";
    orderCard.innerHTML = `
      <h4 class="font-bold">${order.orderBy} - ₹${order.totalAmount.toFixed(
      2
    )}</h4>
      <p class="text-sm text-gray-500">ID: ${order.orderId} | ${new Date(
      order.orderDate
    ).toLocaleDateString()}</p>
    `;
    orderCard.onclick = () => showOrderDetails(order.id);
    pendingListContainer.appendChild(orderCard);
  });

  // Recent Orders List (Top 10)
  const recentListContainer = document.getElementById("recent-orders-list");
  recentListContainer.innerHTML = "";

  const recentOrders = allOrders.slice(0, 10);
  recentOrders.forEach((order) => {
    const orderCard = document.createElement("div");
    const statusColor = order.isDelivered ? "text-green-600" : "text-red-600";
    orderCard.className =
      "bg-white p-4 rounded-lg shadow border cursor-pointer";
    orderCard.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <h4 class="font-bold">${order.orderBy} - ₹${order.totalAmount.toFixed(
      2
    )}</h4>
          <p class="text-sm text-gray-500">ID: ${order.orderId} | ${new Date(
      order.orderDate
    ).toLocaleDateString()}</p>
        </div>
        <span class="font-semibold text-sm ${statusColor}">${
      order.isDelivered ? "Completed" : "Pending"
    }</span>
      </div>
    `;
    orderCard.onclick = () => showOrderDetails(order.id);
    recentListContainer.appendChild(orderCard);
  });
}

// --- INGREDIENTS MANAGER ---
async function renderIngredientsManager(container) {
  // Define the list of units for the dropdown
  const units = [
    "grams",
    "kg",
    "ml",
    "liters",
    "tsp",
    "tbsp",
    "cup",
    "pcs",
    "dozen",
  ];

  container.innerHTML = `
    <div class="form-section">
      <h3 class="text-lg font-bold mb-4">Add/Edit Ingredient</h3>
      <form id="ingredient-form" class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <input type="hidden" id="ingredient-id">
        <div class="flex flex-col">
          <label for="ingredient-name" class="font-semibold text-sm mb-1">Ingredient</label>
          <input required type="text" id="ingredient-name" class="p-2 border rounded-md" placeholder="e.g., Flour">
        </div>
        <div class="flex flex-col">
          <label for="ingredient-cost" class="font-semibold text-sm mb-1">Cost Price (₹)</label>
          <input required type="number" id="ingredient-cost" class="p-2 border rounded-md" placeholder="e.g., 100">
        </div>
        <div class="flex flex-col">
          <label for="ingredient-quantity" class="font-semibold text-sm mb-1">Quantity</label>
          <input required type="number" id="ingredient-quantity" class="p-2 border rounded-md" placeholder="e.g., 1000">
        </div>
        <div class="flex flex-col">
          <label for="ingredient-unit" class="font-semibold text-sm mb-1">Unit</label>
          <select required id="ingredient-unit" class="p-2 border rounded-md bg-white">
            <option value="">Select Unit</option>
            ${units.map((u) => `<option value="${u}">${u}</option>`).join("")}
          </select>
        </div>
        <button type="submit" class="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition">Save</button>
      </form>
    </div>
    <div>
      <h3 class="text-lg font-bold mb-4">Ingredient List</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white rounded-lg shadow">
          <thead class="bg-gray-100"><tr>
            <th class="p-3 text-left font-semibold">Ingredient</th>
            <th class="p-3 text-left font-semibold">Cost</th>
            <th class="p-3 text-left font-semibold">Actions</th>
          </tr></thead>
          <tbody id="ingredients-table"></tbody>
        </table>
      </div>
    </div>
  `;

  const form = container.querySelector("#ingredient-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = form.querySelector("#ingredient-id").value;
    const data = {
      name: form.querySelector("#ingredient-name").value,
      costPrice: parseFloat(form.querySelector("#ingredient-cost").value),
      quantity: parseFloat(form.querySelector("#ingredient-quantity").value),
      unit: form.querySelector("#ingredient-unit").value,
    };

    const docId = id || doc(getCollectionRef("ingredients")).id;
    await setDoc(getDocRef("ingredients", docId), data);
    form.reset();
    document.getElementById("ingredient-id").value = "";
    await loadIngredients();
  };
  await loadIngredients();
}

async function loadIngredients() {
  ingredientsCache = await fetchData("ingredients");
  const table = document.getElementById("ingredients-table");
  table.innerHTML = ingredientsCache
    .map(
      (ing) => `
        <tr class="border-b">
            <td class="p-3">${ing.name}</td>
            <td class="p-3">₹${ing.costPrice} for ${ing.quantity} ${ing.unit}</td>
            <td class="p-3">
                <button class="edit-ingredient mr-3" data-id="${ing.id}">Edit</button>
                <button class="delete-ingredient text-red-600" data-id="${ing.id}">Delete</button>
            </td>
        </tr>
    `
    )
    .join("");

  document.querySelectorAll(".edit-ingredient").forEach(
    (btn) =>
      (btn.onclick = () => {
        const ing = ingredientsCache.find((i) => i.id === btn.dataset.id);
        document.getElementById("ingredient-id").value = ing.id;
        document.getElementById("ingredient-name").value = ing.name;
        document.getElementById("ingredient-cost").value = ing.costPrice;
        document.getElementById("ingredient-quantity").value = ing.quantity;
        document.getElementById("ingredient-unit").value = ing.unit;
      })
  );

  document.querySelectorAll(".delete-ingredient").forEach(
    (btn) =>
      (btn.onclick = async () => {
        if (confirm("Are you sure?")) {
          await deleteDoc(getDocRef("ingredients", btn.dataset.id));
          await loadIngredients();
        }
      })
  );
}

// --- MENU MANAGER ---
async function renderMenuManager(container) {
  container.innerHTML = `
    <div class="form-section">
      <h3 class="text-lg font-bold mb-4">Add/Edit Menu Item</h3>
      <form id="menu-form" class="space-y-4">
        <input type="hidden" id="menu-id">
        <div class="grid grid-cols-1 gap-4">
            <input required class="p-2 border rounded-md" type="text" id="recipe-name" placeholder="Recipe Name">
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select required id="recipe-category" class="p-2 border rounded-md">
            <option value="">Select Category</option>
            ${[
              "Cake",
              "Brownies",
              "Cheesecake",
              "Cookies",
              "Button Cookies",
              "Savory",
              "Mukhwas",
              "Hampers",
              "Chocolates",
              "Cupcakes",
              "Other",
            ]
              .map((c) => `<option value="${c}">${c}</option>`)
              .join("")}
          </select>
            <input required class="p-2 border rounded-md" type="number" id="recipe-capacity" placeholder="Max capacity per batch">
            <input required class="p-2 border rounded-md" type="number" id="recipe-duration" placeholder="Baking duration (minutes)">
            <input required class="p-2 border rounded-md" type="number" id="baked-quantity" placeholder="Baked Quantity">
        </div>
        <div>
          <h4 class="font-semibold mb-2">Ingredients</h4>
          <div id="recipe-ingredients-list" class="space-y-2"></div>
          <button type="button" id="add-recipe-ingredient" class="mt-2 text-sm bg-gray-200 px-3 py-1 rounded-md">+ Add Ingredient</button>
        </div>
        <div>
          <h4 class="font-semibold mb-2">Packaging Options</h4>
          <div id="packaging-options-list" class="space-y-2"></div>
          <button type="button" id="add-packaging-option" class="mt-2 text-sm bg-gray-200 px-3 py-1 rounded-md">+ Add Packaging Option</button>
        </div>
        <button type="submit" class="bg-black text-white px-4 py-2 rounded-md w-full">Save Menu Item</button>
      </form>
    </div>
     <div>
      <h3 class="text-lg font-bold mb-4">Menu List</h3>
      <div id="menu-table" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    </div>
  `;

  await loadIngredients();

  const ingredientsListDiv = container.querySelector(
    "#recipe-ingredients-list"
  );
  const addIngredientBtn = container.querySelector("#add-recipe-ingredient");

  const packagingListDiv = container.querySelector("#packaging-options-list");
  const addPackagingBtn = container.querySelector("#add-packaging-option");

  // Inside renderMenuManager(container)
  const addIngredientField = (item = {}) => {
    const div = document.createElement("div");
    // Added relative positioning here
    div.className =
      "dynamic-list-item flex flex-col md:flex-row gap-2 items-center relative";
    div.innerHTML = `
    <select required class="ingredient-select w-full p-2 border rounded-md bg-white">
      <option value="">Select Ingredient</option>
      ${ingredientsCache
        .map(
          (i) =>
            `<option value="${i.id}" ${item.id === i.id ? "selected" : ""}>${
              i.name
            }</option>`
        )
        .join("")}
    </select>
    <input required class="consumed-quantity w-full md:w-32 p-2 border rounded-md" type="number" placeholder="Quantity" value="${
      item.consumedQuantity || ""
    }">
    <span class="ingredient-cost-display text-sm font-semibold text-gray-700 w-full md:w-auto"></span>
    <button type="button" class="remove-ingredient-btn absolute top-2 right-2 text-red-500 font-bold">X</button>
  `;
    ingredientsListDiv.appendChild(div);
    div.querySelector(".remove-ingredient-btn").onclick = () => div.remove();

    const updateCost = () => {
      const select = div.querySelector(".ingredient-select");
      const input = div.querySelector(".consumed-quantity");
      const costDisplay = div.querySelector(".ingredient-cost-display");

      const ingredient = ingredientsCache.find((i) => i.id === select.value);
      const quantity = parseFloat(input.value);

      if (ingredient && quantity) {
        const cost = (quantity * ingredient.costPrice) / ingredient.quantity;
        costDisplay.textContent = `(₹${cost.toFixed(2)})`;
      } else {
        costDisplay.textContent = "";
      }
    };

    // Add event listeners
    div.querySelector(".ingredient-select").onchange = updateCost;
    div.querySelector(".consumed-quantity").oninput = updateCost;

    // Initial cost update if item is provided
    if (item.id) {
      updateCost();
    }
  };

  const addPackagingField = (pack = {}) => {
    const div = document.createElement("div");
    // Added relative positioning here
    div.className =
      "dynamic-list-item flex flex-col md:flex-row gap-2 items-center relative";
    div.innerHTML = `
      <select class="package-value w-full md:flex-grow p-2 border rounded-md">
        ${[...Array(12).keys()]
          .map(
            (i) =>
              `<option value="${i + 1}" ${
                pack.value === i + 1 ? "selected" : ""
              }>Pack of ${i + 1}</option>`
          )
          .join("")}
      </select>
      <input required class="package-mrp w-full md:w-32 p-2 border rounded-md" type="number" placeholder="MRP" value="${
        pack.mrp || ""
      }">
      <button type="button" class="remove-packaging-btn absolute top-2 right-2 text-red-500 font-bold">X</button>
    `;
    packagingListDiv.appendChild(div);
    div.querySelector(".remove-packaging-btn").onclick = () => div.remove();
  };

  addIngredientBtn.onclick = () => addIngredientField();
  addPackagingBtn.onclick = () => addPackagingField();

  const form = container.querySelector("#menu-form");
  form.onsubmit = async (e) => {
    e.preventDefault();

    // Calculate cost
    let totalCost = 0;
    const ingredientsForRecipe = [];
    const ingredientRows =
      ingredientsListDiv.querySelectorAll(".dynamic-list-item");

    for (const row of ingredientRows) {
      const ingredientId = row.querySelector(".ingredient-select").value;
      const consumedQuantity = parseFloat(
        row.querySelector(".consumed-quantity").value
      );
      const masterIngredient = ingredientsCache.find(
        (i) => i.id === ingredientId
      );

      if (!masterIngredient || !consumedQuantity) continue;

      const ingredientCost =
        (consumedQuantity * masterIngredient.costPrice) /
        masterIngredient.quantity;
      totalCost += ingredientCost;
      ingredientsForRecipe.push({
        id: ingredientId,
        name: masterIngredient.name,
        unit: masterIngredient.unit,
        consumedQuantity,
      });
    }

    const packagingOptions = Array.from(
      packagingListDiv.querySelectorAll(".dynamic-list-item")
    ).map((item) => ({
      value: parseInt(item.querySelector(".package-value").value),
      mrp: parseFloat(item.querySelector(".package-mrp").value),
    }));

    const id = form.querySelector("#menu-id").value;
    const data = {
      name: form.querySelector("#recipe-name").value,
      category: form.querySelector("#recipe-category").value,
      maxCapacity: parseInt(form.querySelector("#recipe-capacity").value),
      bakingDuration: parseInt(form.querySelector("#recipe-duration").value),
      bakedQuantity: parseInt(form.querySelector("#baked-quantity").value),
      ingredients: ingredientsForRecipe,
      packagingOptions: packagingOptions,
      cost: parseFloat(totalCost.toFixed(2)),
    };

    const docId = id || doc(getCollectionRef("menu")).id;
    await setDoc(getDocRef("menu", docId), data);

    form.reset();
    ingredientsListDiv.innerHTML = "";
    packagingListDiv.innerHTML = "";
    await loadMenu();
  };

  await loadMenu();
}

function showMenuDetails(item) {
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50";
  modal.innerHTML = `
    <div class="relative bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
      <h2 class="text-2xl font-bold mb-4">${item.name} Ingredients</h2>
      <ul class="space-y-2">
        ${item.ingredients
          .map((ing) => {
            const masterIngredient = ingredientsCache.find(
              (i) => i.id === ing.id
            );
            const cost = masterIngredient
              ? (ing.consumedQuantity * masterIngredient.costPrice) /
                masterIngredient.quantity
              : 0;
            return `
                <li class="flex justify-between items-center bg-gray-100 p-2 rounded">
                    <span>${ing.name}: ${ing.consumedQuantity} ${
              ing.unit
            }</span>
                    <span class="font-semibold">₹${cost.toFixed(2)}</span>
                </li>
            `;
          })
          .join("")}
      </ul>
      <button class="mt-6 w-full bg-black text-white px-4 py-2 rounded-md" onclick="document.body.removeChild(this.closest('.fixed'));">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function loadMenu() {
  function renderMenuCard(item) {
    const costPerUnit =
      item.bakedQuantity > 0 ? (item.cost / item.bakedQuantity).toFixed(2) : 0;
    const cardDiv = document.createElement("div");
    cardDiv.className = "bg-white p-4 rounded-lg shadow border cursor-pointer";
    cardDiv.innerHTML = `
            <h4 class="font-bold text-lg">${item.name}</h4>
            <p class="text-sm text-gray-500">${item.category}</p>
            <div class="font-semibold text-xl">
                <p>Cost per Unit: ₹${costPerUnit}</p>
            </div>
            <div class="font-semibold text-l my-2">
                <p>Recipe Cost: ₹${item.cost.toFixed(2)}</p>
            </div>
            <div class="text-xs">
                <p><strong>Capacity:</strong> ${item.maxCapacity} pcs/batch</p>
                <p><strong>Baking Time:</strong> ${item.bakingDuration} mins</p>
                <p><strong>Baked Quantity:</strong> ${item.bakedQuantity}</p>
            </div>
            <div class="mt-4">
                <button class="edit-menu mr-3" data-id="${
                  item.id
                }">Edit</button>
                <button class="delete-menu text-red-600" data-id="${
                  item.id
                }">Delete</button>
            </div>
        `;
    cardDiv.onclick = (e) => {
      // Prevent click event from bubbling up to the card div if edit/delete buttons are clicked
      if (e.target.tagName === "BUTTON") return;
      showMenuDetails(item);
    };
    return cardDiv;
  }

  menuCache = await fetchData("menu");
  const table = document.getElementById("menu-table");
  table.innerHTML = ""; // Clear the container
  menuCache.forEach((item) => {
    table.appendChild(renderMenuCard(item));
  });

  document.querySelectorAll(".delete-menu").forEach(
    (btn) =>
      (btn.onclick = async () => {
        if (confirm("Are you sure?")) {
          await deleteDoc(getDocRef("menu", btn.dataset.id));
          await loadMenu();
        }
      })
  );

  document.querySelectorAll(".edit-menu").forEach(
    (btn) =>
      (btn.onclick = async () => {
        const item = menuCache.find((i) => i.id === btn.dataset.id);
        document.getElementById("menu-id").value = item.id;
        document.getElementById("recipe-name").value = item.name;
        document.getElementById("recipe-category").value = item.category;
        document.getElementById("recipe-capacity").value = item.maxCapacity;
        document.getElementById("recipe-duration").value = item.bakingDuration;
        document.getElementById("baked-quantity").value = item.bakedQuantity;

        const ingredientsListDiv = document.getElementById(
          "recipe-ingredients-list"
        );
        ingredientsListDiv.innerHTML = "";
        item.ingredients.forEach((ing) => {
          const div = document.createElement("div");
          div.className = "dynamic-list-item";
          div.innerHTML = `
                <select required class="ingredient-select flex-grow p-2 border rounded-md bg-white">
                    <option value="">Select Ingredient</option>
                    ${ingredientsCache
                      .map(
                        (i) =>
                          `<option value="${i.id}" ${
                            ing.id === i.id ? "selected" : ""
                          }>${i.name}</option>`
                      )
                      .join("")}
                </select>
                <input required class="consumed-quantity p-2 border rounded-md w-32" type="number" placeholder="Quantity" value="${
                  ing.consumedQuantity || ""
                }">
                <button type="button" class="remove-ingredient-btn text-red-500 font-bold">X</button>
            `;
          ingredientsListDiv.appendChild(div);
          div.querySelector(".remove-ingredient-btn").onclick = () =>
            div.remove();
        });

        const packagingListDiv = document.getElementById(
          "packaging-options-list"
        );
        packagingListDiv.innerHTML = "";
        if (item.packagingOptions) {
          item.packagingOptions.forEach((pack) => {
            const div = document.createElement("div");
            div.className = "dynamic-list-item flex gap-2 items-center";
            div.innerHTML = `
              <select class="package-value p-2 border rounded-md">
                ${[...Array(12).keys()]
                  .map(
                    (i) =>
                      `<option value="${i + 1}" ${
                        pack.value === i + 1 ? "selected" : ""
                      }>Pack of ${i + 1}</option>`
                  )
                  .join("")}
              </select>
              <input required class="package-mrp p-2 border rounded-md" type="number" placeholder="MRP" value="${
                pack.mrp || ""
              }">
              <button type="button" class="remove-packaging-btn text-red-500 font-bold">X</button>
            `;
            packagingListDiv.appendChild(div);
            div.querySelector(".remove-packaging-btn").onclick = () =>
              div.remove();
          });
        }
        window.scrollTo(0, 0); // Scroll to top to see the form
      })
  );
}

// --- ORDER MANAGER ---
async function renderOrderManager(container) {
  container.innerHTML = `
    <div class="form-section">
      <h3 class="text-lg font-bold mb-4">Create New Order</h3>
      <form id="order-form" class="space-y-4">
        <input type="hidden" id="order-id">
        <input required class="p-2 border rounded-md w-full" type="text" id="order-by" placeholder="Order By (Customer Name)">
        <div>
          <h4 class="font-semibold mb-2">Menu Items</h4>
          <div id="order-items-list" class="space-y-2"></div>
          <button type="button" id="add-order-item" class="mt-2 text-sm bg-gray-200 px-3 py-1 rounded-md">+ Add Item</button>
        </div>
        <button type="submit" class="bg-black text-white px-4 py-2 rounded-md w-full">Create Order</button>
      </form>
    </div>
    <div>
      <h3 class="text-lg font-bold mb-4">Order History</h3>
      <div id="orders-table" class="space-y-4"></div>
    </div>
  `;

  await loadMenu(); // Ensure menu is loaded

  const orderItemsListDiv = container.querySelector("#order-items-list");
  const addOrderItemBtn = container.querySelector("#add-order-item");

  const addOrderItemField = () => {
    const div = document.createElement("div");
    div.className =
      "dynamic-list-item flex flex-col md:flex-row gap-2 items-center relative";
    div.innerHTML = `
      <select required class="menu-item-select w-full p-2 border rounded-md bg-white">
        <option value="">Select Menu Item</option>
        ${menuCache
          .map((i) => `<option value="${i.id}">${i.name}</option>`)
          .join("")}
      </select>
      <select required class="item-packaging-select w-full p-2 border rounded-md bg-white">
        <option value="">Select Packaging</option>
      </select>
      <input required class="item-quantity w-full md:w-32 p-2 border rounded-md" type="number" placeholder="Quantity">
      <span class="item-price-display text-sm font-semibold text-gray-700 w-full md:w-auto"></span>
      <button type="button" class="remove-order-item-btn absolute top-2 right-2 text-red-500 font-bold">X</button>
    `;
    orderItemsListDiv.appendChild(div);
    div.querySelector(".remove-order-item-btn").onclick = () => div.remove();

    const menuItemSelect = div.querySelector(".menu-item-select");
    const packagingSelect = div.querySelector(".item-packaging-select");
    const inputQuantity = div.querySelector(".item-quantity");
    const priceDisplay = div.querySelector(".item-price-display");

    const updatePrice = () => {
      const menuItem = menuCache.find((i) => i.id === menuItemSelect.value);
      const quantity = parseInt(inputQuantity.value);
      const selectedPackage = packagingSelect
        ? menuItem.packagingOptions.find(
            (p) => p.value === parseInt(packagingSelect.value)
          )
        : null;

      if (menuItem && quantity && selectedPackage) {
        const totalAmount = selectedPackage.mrp * quantity;
        priceDisplay.textContent = `(₹${totalAmount.toFixed(2)})`;
      } else {
        priceDisplay.textContent = "";
      }
    };

    menuItemSelect.onchange = () => {
      const selectedItem = menuCache.find((i) => i.id === menuItemSelect.value);
      if (selectedItem && selectedItem.packagingOptions) {
        packagingSelect.innerHTML =
          `<option value="">Select Packaging</option>` +
          selectedItem.packagingOptions
            .map(
              (p) =>
                `<option value="${p.value}">Pack of ${p.value} (₹${p.mrp})</option>`
            )
            .join("");
      }
      updatePrice();
    };

    packagingSelect.onchange = updatePrice;
    inputQuantity.oninput = updatePrice;
  };

  addOrderItemBtn.onclick = addOrderItemField;

  container.querySelector("#order-form").onsubmit = async (e) => {
    e.preventDefault();
    const ELECTRICITY_COST_PER_HOUR = 24;
    let totalOrderAmount = 0;
    const itemsForOrder = [];

    const itemRows = orderItemsListDiv.querySelectorAll(".dynamic-list-item");
    for (const row of itemRows) {
      const menuItemId = row.querySelector(".menu-item-select").value;
      const orderedQuantity = parseInt(
        row.querySelector(".item-quantity").value
      );
      const packagingValue = parseInt(
        row.querySelector(".item-packaging-select").value
      );
      const masterMenuItem = menuCache.find((i) => i.id === menuItemId);

      if (!masterMenuItem || !orderedQuantity || !packagingValue) continue;

      const selectedPackage = masterMenuItem.packagingOptions.find(
        (p) => p.value === packagingValue
      );
      const totalMRP = selectedPackage.mrp * orderedQuantity;

      totalOrderAmount += totalMRP;
      itemsForOrder.push({
        id: menuItemId,
        name: masterMenuItem.name,
        quantity: orderedQuantity,
        packagingValue: packagingValue,
      });
    }

    const id = doc(getCollectionRef("orders")).id;
    const data = {
      orderId: `CT-${Date.now()}`,
      orderBy: document.getElementById("order-by").value,
      orderDate: new Date().toISOString(),
      isDelivered: false,
      items: itemsForOrder,
      totalAmount: parseFloat(totalOrderAmount.toFixed(2)),
    };

    await setDoc(getDocRef("orders", id), data);
    e.target.reset();
    orderItemsListDiv.innerHTML = "";
    await loadOrders();
    await loadDashboardData();
  };

  await loadOrders();
}

async function loadOrders() {
  orders = await fetchData("orders");
  const table = document.getElementById("orders-table");
  table.innerHTML = ""; // Clear existing content

  orders
    .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
    .forEach((order) => {
      const orderCard = document.createElement("div");
      const statusText = order.isDelivered ? "Completed" : "Pending";
      const statusColor = order.isDelivered ? "text-green-600" : "text-red-600";

      orderCard.className =
        "bg-white p-4 rounded-lg shadow border cursor-pointer";
      orderCard.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold">${order.orderBy}</h4>
                    <p class="text-xs text-gray-500">ID: ${
                      order.orderId
                    } | ${new Date(order.orderDate).toLocaleDateString()}</p>
                    <span class="font-semibold text-sm ${statusColor}">${statusText}</span>
                </div>
                <div class="text-right">
                    <p class="font-bold text-xl">₹${order.totalAmount.toFixed(
                      2
                    )}</p>
                    <button class="delete-order text-red-600 text-xs" data-id="${
                      order.id
                    }">Delete</button>
                </div>
            </div>
            <ul class="text-sm mt-3 list-disc list-inside bg-gray-50 p-2 rounded">
                ${order.items
                  .map((item) => `<li>${item.quantity} x ${item.name}</li>`)
                  .join("")}
            </ul>
        `;

      // Attach the click event listener in JavaScript
      orderCard.addEventListener("click", (e) => {
        // Check if the click was on the delete button to prevent showing details
        if (!e.target.classList.contains("delete-order")) {
          showOrderDetails(order.id);
        }
      });

      table.appendChild(orderCard);
    });

  document.querySelectorAll(".delete-order").forEach(
    (btn) =>
      (btn.onclick = async () => {
        if (confirm("Are you sure?")) {
          await deleteDoc(getDocRef("orders", btn.dataset.id));
          await loadOrders();
        }
      })
  );
}

// New function to display detailed order view
function showOrderDetails(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  let totalMakingCost = 0;
  const itemsHtml = order.items
    .map((item) => {
      const menuItem = menuCache.find((m) => m.id === item.id);
      if (!menuItem) return "";

      // Calculate Making Cost for this item
      const totalCookies = item.quantity * item.packagingValue;
      const totalBatches = Math.ceil(totalCookies / menuItem.maxCapacity);
      const totalDuration = totalBatches * menuItem.bakingDuration;
      const electricityCost = (totalDuration * 24) / 60; // 24 is assumed price per hour
      const makingCost =
        (menuItem.cost * totalCookies) / menuItem.bakedQuantity +
        electricityCost;

      totalMakingCost += makingCost;

      const selectedPackage = menuItem.packagingOptions.find(
        (p) => p.value === item.packagingValue
      );
      const itemMRP = selectedPackage ? selectedPackage.mrp : 0;

      return `
            <li class="bg-gray-100 p-2 rounded">
                <span>${item.quantity} x ${item.name} (Pack of ${
        item.packagingValue
      })</span>
                <span class="font-semibold block">MRP: ₹${(
                  item.quantity * itemMRP
                ).toFixed(2)}</span>
                <span class="text-sm">Making Cost: ₹${makingCost.toFixed(
                  2
                )}</span>
            </li>
        `;
    })
    .join("");

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50";

  const deliveredText = order.isDelivered ? "Delivered" : "Pending";

  modal.innerHTML = `
    <div class="relative bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
        <h2 class="text-2xl font-bold mb-4">Order Details for ${
          order.orderBy
        }</h2>
        <p class="text-sm text-gray-500 mb-4">ID: ${order.orderId}</p>
        <p class="font-bold">Status: <span class="text-${
          order.isDelivered ? "green" : "red"
        }-600">${deliveredText}</span></p>
        <div class="mt-4">
            <label class="inline-flex items-center">
                <input type="checkbox" class="form-checkbox" id="delivered-checkbox" ${
                  order.isDelivered ? "checked" : ""
                }>
                <span class="ml-2">Mark as Delivered</span>
            </label>
        </div>
        <ul class="space-y-2 mt-4">
            ${itemsHtml}
        </ul>
        <div class="mt-4 pt-4 border-t border-gray-200">
            <p class="font-bold text-lg flex justify-between">Total MRP: <span>₹${order.totalAmount.toFixed(
              2
            )}</span></p>
            <p class="text-sm text-gray-500 flex justify-between">Total Making Cost: <span>₹${totalMakingCost.toFixed(
              2
            )}</span></p>
        </div>
        <button class="mt-6 w-full bg-black text-white px-4 py-2 rounded-md" onclick="document.body.removeChild(this.closest('.fixed'));">Close</button>
    </div>
    `;

  document.body.appendChild(modal);

  const deliveredCheckbox = modal.querySelector("#delivered-checkbox");
  deliveredCheckbox.onchange = async (e) => {
    await setDoc(
      getDocRef("orders", orderId),
      { isDelivered: e.target.checked },
      { merge: true }
    );
    // The modal content might need a refresh or the user can close and re-open to see the change.
    await loadOrders(); // This line is the fix
    await loadDashboardData();
    document.body.removeChild(modal); // Close the modal to see the updated list
  };
}

const chores = [
  { name: "Clear the desk", xp: 30, colors: ["#ffdc5f", "#ff6b6b"] },
  { name: "Take out trash", xp: 45, colors: ["#68e1fd", "#2d6cdf"] },
  { name: "Fold laundry", xp: 60, colors: ["#a8ff78", "#33b86f"] },
  { name: "Wash dishes", xp: 55, colors: ["#f7a8ff", "#8c52ff"] },
  { name: "Vacuum room", xp: 70, colors: ["#ffbd59", "#ff5757"] },
  { name: "Make the bed", xp: 35, colors: ["#7cf7d4", "#139e9a"] },
  { name: "Wipe counters", xp: 40, colors: ["#fff174", "#ff9f1c"] },
  { name: "Sort backpack", xp: 50, colors: ["#a2d2ff", "#4361ee"] },
  { name: "Feed pet", xp: 25, colors: ["#ffd6a5", "#fb8500"] },
  { name: "Bathroom reset", xp: 80, colors: ["#caffbf", "#2ec4b6"] }
];

const layout = [
  [14, 73], [28, 58], [42, 78], [58, 60], [73, 74],
  [20, 86], [37, 91], [53, 88], [68, 91], [82, 84]
];

const playfield = document.querySelector("#playfield");
const ticketList = document.querySelector("#ticketList");
const clawRig = document.querySelector("#clawRig");
const claw = document.querySelector("#claw");
const cable = document.querySelector("#cable");
const dropButton = document.querySelector("#dropButton");
const shuffleButton = document.querySelector("#shuffleButton");
const selectedChore = document.querySelector("#selectedChore");
const streakEl = document.querySelector("#streak");
const xpEl = document.querySelector("#xp");
const toast = document.querySelector("#toast");

let clawX = 50;
let clawY = 26;
let velocityX = 0;
let velocityY = 0;
let clawSway = 0;
let dropCableHeight = null;
let lastFrame = performance.now();
let xp = 0;
let streak = 0;
let busy = false;
let selectedIndex = null;
const caughtChores = new Set();
const heldDirections = new Set();

function renderCapsules() {
  document.querySelectorAll(".capsule, .floor").forEach((item) => item.remove());

  const floor = document.createElement("div");
  floor.className = "floor";
  playfield.appendChild(floor);

  chores.forEach((chore, index) => {
    if (caughtChores.has(index)) return;

    const capsule = document.createElement("button");
    capsule.className = "capsule";
    capsule.type = "button";
    capsule.dataset.index = index;
    capsule.style.left = `${layout[index][0]}%`;
    capsule.style.top = `${layout[index][1]}%`;
    capsule.style.setProperty("--c1", chore.colors[0]);
    capsule.style.setProperty("--c2", chore.colors[1]);
    capsule.style.setProperty("--tilt", `${(index % 5 - 2) * 7}deg`);
    capsule.textContent = chore.name;
    capsule.addEventListener("click", () => aimAt(index));
    playfield.appendChild(capsule);
  });
}

function renderTickets() {
  ticketList.innerHTML = "";

  chores.forEach((chore, index) => {
    if (caughtChores.has(index)) return;

    const ticket = document.createElement("article");
    ticket.className = "ticket";
    ticket.innerHTML = `
      <span class="ticket-dot" style="--c1:${chore.colors[0]}; --c2:${chore.colors[1]}"></span>
      <span><strong>${chore.name}</strong><small>${chore.xp} XP reward</small></span>
      <button type="button" data-index="${index}">Target</button>
    `;
    ticket.querySelector("button").addEventListener("click", () => aimAt(index));
    ticketList.appendChild(ticket);
  });

  if (ticketList.children.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ticket-empty";
    empty.textContent = "All chores caught. Cabinet cleared.";
    ticketList.appendChild(empty);
  }
}

function updateClaw() {
  clawRig.style.left = `${clawX}%`;
  cable.style.height = `${dropCableHeight ?? normalCableHeight()}px`;
  cable.style.transform = `rotate(${clawSway * 0.38}deg)`;
  claw.style.transform = `translateX(${clawSway * 0.45}px) rotate(${clawSway}deg)`;
}

function normalCableHeight() {
  return 84 + Math.max(0, clawY - 26) * 2.3;
}

function setDropCable(height) {
  dropCableHeight = height;
  updateClaw();
}

function aimAt(index) {
  if (busy || caughtChores.has(index)) return;

  selectedIndex = index;
  highlightCapsules();
  selectedChore.textContent = `Target marked: ${chores[index].name}. Move the claw over it.`;
  updateClaw();
}

function moveClaw(direction) {
  if (busy) return;

  const impulse = 12;
  if (direction === "left") velocityX -= impulse;
  if (direction === "right") velocityX += impulse;
  if (direction === "up") velocityY -= impulse * 0.72;
  if (direction === "down") velocityY += impulse * 0.72;
}

function nearestCapsule(includeCaught = false) {
  let closest = null;
  let closestDistance = Infinity;

  layout.forEach(([x, y], index) => {
    if (!includeCaught && caughtChores.has(index)) return;

    const distance = Math.hypot(clawX - x, (clawY + 32) - y);
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
  });

  return closest;
}

function highlightCapsules() {
  const hotIndex = nearestCapsule();
  const hotEnough = hotIndex !== null
    && Math.abs(clawX - layout[hotIndex][0]) <= 11
    && Math.abs((clawY + 32) - layout[hotIndex][1]) <= 13;

  document.querySelectorAll(".capsule").forEach((capsule) => {
    const index = Number(capsule.dataset.index);
    capsule.classList.toggle("active", index === selectedIndex);
    capsule.classList.toggle("hot", index === hotIndex && hotEnough);
  });
}

function grabReliability(xDistance, yDistance) {
  const speed = Math.hypot(velocityX, velocityY);
  const alignmentPenalty = (xDistance / 14) * 0.36 + (yDistance / 17) * 0.3;
  const motionPenalty = Math.min(0.36, speed / 115);
  const swayPenalty = Math.min(0.26, Math.abs(clawSway) / 38);
  return Math.max(0.12, Math.min(0.96, 1 - alignmentPenalty - motionPenalty - swayPenalty));
}

function dropClaw() {
  if (busy) return;

  busy = true;
  heldDirections.clear();
  const grabIndex = nearestCapsule();
  if (grabIndex === null) {
    busy = false;
    showToast("No capsules left. Cabinet cleared.");
    selectedChore.textContent = "All chores are caught.";
    return;
  }

  highlightCapsules();

  const chore = chores[grabIndex];
  const [targetX, targetY] = layout[grabIndex];
  const targetCapsule = document.querySelector(`.capsule[data-index="${grabIndex}"]`);
  const xDistance = Math.abs(clawX - targetX);
  const yDistance = Math.abs((clawY + 32) - targetY);
  const reliability = grabReliability(xDistance, yDistance);
  const centeredEnough = xDistance <= 11 && yDistance <= 13;
  const success = centeredEnough && Math.random() <= reliability;
  const liftY = Math.max(31, targetY - 30);
  const chuteX = 82;
  const chuteY = 88;
  const loweredCableHeight = Math.min(250, 84 + targetY * 1.95);

  setDropCable(loweredCableHeight);
  claw.classList.remove("grabbing");
  selectedChore.textContent = `Dropping toward ${chore.name}.`;
  velocityX *= 0.32;
  velocityY *= 0.32;

  setTimeout(() => {
    claw.classList.add("grabbing");
    if (success) {
      targetCapsule?.classList.add("carried");
      targetCapsule.style.left = `${targetX}%`;
      targetCapsule.style.top = `${targetY}%`;
    } else if (centeredEnough) {
      targetCapsule?.classList.add("slipping");
    }
    setDropCable(normalCableHeight());
  }, 620);

  setTimeout(() => {
    dropCableHeight = null;
    if (success) {
      targetCapsule.style.top = `${liftY}%`;
      targetCapsule.style.transform = "translate(-50%, -50%) rotate(-4deg) scale(1.05)";
      selectedChore.textContent = `${chore.name} grabbed. Carrying it to the chute.`;
    } else {
      claw.classList.remove("grabbing");
      streak = 0;
      streakEl.textContent = streak;
      selectedChore.textContent = centeredEnough
        ? `${chore.name} slipped out. Slow the claw before dropping.`
        : `Missed ${chore.name}. Move closer and try again.`;
      showToast(centeredEnough ? "Slip. The claw was swinging too much." : "Miss. Center the claw over a capsule.");
      setTimeout(() => targetCapsule?.classList.remove("slipping"), 620);
      highlightCapsules();
      busy = false;
    }
  }, 1180);

  if (success) {
    setTimeout(() => {
      clawX = chuteX;
      velocityX = 0;
      velocityY = 0;
      targetCapsule.style.left = `${chuteX}%`;
      targetCapsule.style.top = `${chuteY}%`;
      targetCapsule.style.transform = "translate(-50%, -50%) rotate(12deg) scale(0.88)";
      updateClaw();
    }, 1680);

    setTimeout(() => {
      targetCapsule?.classList.add("delivered");
      claw.classList.remove("grabbing");
    }, 2200);

    setTimeout(() => {
      caughtChores.add(grabIndex);
      targetCapsule?.classList.add("caught");
      streak += 1;
      xp += chore.xp + Math.max(0, streak - 1) * 10;
      xpEl.textContent = String(xp).padStart(3, "0");
      streakEl.textContent = streak;
      selectedChore.textContent = `${chore.name} dropped in the chute. Finish it for ${chore.xp} XP.`;
      showToast(`Prize chute drop: ${chore.name}. Streak x${streak}.`);
      if (selectedIndex === grabIndex) selectedIndex = null;
      renderTickets();
      renderCapsules();
      highlightCapsules();
      dropCableHeight = null;
      busy = false;
    }, 2580);
  }
}

function shuffleCapsules() {
  for (let i = layout.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [layout[i], layout[j]] = [layout[j], layout[i]];
  }
  renderCapsules();
  renderTickets();
  selectedIndex = null;
  streak = 0;
  velocityX = 0;
  velocityY = 0;
  clawSway = 0;
  dropCableHeight = null;
  streakEl.textContent = streak;
  selectedChore.textContent = "Capsules shuffled. Move the claw to grab one.";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

document.querySelectorAll("[data-move]").forEach((button) => {
  const direction = button.dataset.move;
  button.addEventListener("pointerdown", () => {
    heldDirections.add(direction);
    moveClaw(direction);
  });
  button.addEventListener("pointerup", () => heldDirections.delete(direction));
  button.addEventListener("pointerleave", () => heldDirections.delete(direction));
  button.addEventListener("pointercancel", () => heldDirections.delete(direction));
});

document.addEventListener("keydown", (event) => {
  const keys = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down"
  };

  if (keys[event.key]) {
    event.preventDefault();
    heldDirections.add(keys[event.key]);
    if (!event.repeat) moveClaw(keys[event.key]);
  }

  if (event.code === "Space") {
    event.preventDefault();
    dropClaw();
  }
});

document.addEventListener("keyup", (event) => {
  const keys = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down"
  };

  if (keys[event.key]) heldDirections.delete(keys[event.key]);
});

dropButton.addEventListener("click", dropClaw);
shuffleButton.addEventListener("click", shuffleCapsules);

renderCapsules();
renderTickets();
updateClaw();

function updatePhysics(now) {
  const delta = Math.min(0.04, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!busy) {
    const acceleration = 78;
    if (heldDirections.has("left")) velocityX -= acceleration * delta;
    if (heldDirections.has("right")) velocityX += acceleration * delta;
    if (heldDirections.has("up")) velocityY -= acceleration * 0.68 * delta;
    if (heldDirections.has("down")) velocityY += acceleration * 0.68 * delta;
  }

  velocityX = Math.max(-58, Math.min(58, velocityX));
  velocityY = Math.max(-38, Math.min(38, velocityY));

  clawX += velocityX * delta;
  clawY += velocityY * delta;

  if (clawX < 10 || clawX > 90) {
    clawX = Math.max(10, Math.min(90, clawX));
    velocityX *= -0.28;
  }

  if (clawY < 22 || clawY > 52) {
    clawY = Math.max(22, Math.min(52, clawY));
    velocityY *= -0.24;
  }

  const damping = Math.pow(busy ? 0.08 : 0.18, delta);
  velocityX *= damping;
  velocityY *= damping;
  clawSway += ((velocityX * 0.18) - clawSway) * Math.min(1, delta * 7.5);
  clawSway = Math.max(-18, Math.min(18, clawSway));

  highlightCapsules();
  updateClaw();
  requestAnimationFrame(updatePhysics);
}

requestAnimationFrame(updatePhysics);

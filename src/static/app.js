document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // User icon and login modal logic
  const userIcon = document.getElementById('user-icon');
  const loginDropdown = document.getElementById('login-dropdown');
  const loginBtn = document.getElementById('login-btn');
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const loginCancel = document.getElementById('login-cancel');
  const loginError = document.getElementById('login-error');

  let isTeacher = false;

  // Show/hide login dropdown (fix: only toggle on icon click, not on body click)
  userIcon.addEventListener('click', function(e) {
    e.stopPropagation();
    loginDropdown.style.display = loginDropdown.style.display === 'block' ? 'none' : 'block';
  });
  document.body.addEventListener('click', function(e) {
    if (!userIcon.contains(e.target) && !loginDropdown.contains(e.target)) {
      loginDropdown.style.display = 'none';
    }
  });

  // Show login modal
  loginBtn.addEventListener('click', function() {
    loginModal.style.display = 'flex';
    loginDropdown.style.display = 'none';
    loginError.textContent = '';
  });
  // Hide login modal
  loginCancel.addEventListener('click', function() {
    loginModal.style.display = 'none';
    loginForm.reset();
    loginError.textContent = '';
  });

  // Handle login form submit
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        loginError.textContent = err.detail || 'Login failed';
        return;
      }
      const data = await res.json();
      localStorage.setItem('teacherToken', data.token);
      localStorage.setItem('teacherUsername', data.username);
      isTeacher = true;
      loginModal.style.display = 'none';
      loginForm.reset();
      loginError.textContent = '';
      // Force reload to ensure new JS is loaded and DOM is fresh
      window.location.reload();
    } catch (err) {
      loginError.textContent = 'Login failed';
    }
  });

  // On page load, check if already logged in
  if (localStorage.getItem('teacherToken')) {
    isTeacher = true;
  } else {
    isTeacher = false;
  }

  // Expose a logout function for debugging
  window.logoutTeacher = function() {
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherUsername');
    isTeacher = false;
    fetchActivities();
  };

  // Category filter logic
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  const searchFilter = document.getElementById('search-filter');
  let allActivities = {};

  categoryFilter.addEventListener('change', renderActivities);
  sortFilter.addEventListener('change', renderActivities);
  searchFilter.addEventListener('input', renderActivities);

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();
      allActivities = activities;
      // Populate category filter only once
      if (categoryFilter.options.length <= 1) {
        const categories = Array.from(new Set(Object.values(activities).map(a => a.category))).sort();
        categoryFilter.innerHTML = '<option value="">All</option>' + categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
      }
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function renderActivities() {
    const filterCat = categoryFilter.value;
    const sortBy = sortFilter.value;
    const searchText = searchFilter.value.trim().toLowerCase();
    let entries = Object.entries(allActivities);
    if (filterCat) {
      entries = entries.filter(([_, details]) => details.category === filterCat);
    }
    if (searchText) {
      entries = entries.filter(([name, details]) =>
        name.toLowerCase().includes(searchText) ||
        details.description.toLowerCase().includes(searchText) ||
        details.category.toLowerCase().includes(searchText) ||
        details.schedule.toLowerCase().includes(searchText)
      );
    }
    // Sort logic
    entries.sort((a, b) => {
      if (sortBy === 'name') {
        return a[0].localeCompare(b[0]);
      } else if (sortBy === 'category') {
        return a[1].category.localeCompare(b[1].category) || a[0].localeCompare(b[0]);
      } else if (sortBy === 'date') {
        // Sort by date field (ISO format)
        return new Date(a[1].date) - new Date(b[1].date);
      }
      return 0;
    });
    activitiesList.innerHTML = "";
    entries.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";
      const spotsLeft = details.max_participants - details.participants.length;
      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
            <h5>Participants:</h5>
            <ul class="participants-list">
              ${details.participants
                .map(
                  (email) =>
                    `<li><span class="participant-email">${email}</span><button class="delete-btn unregister-btn" data-activity="${name}" data-email="${email}" style="display:${isTeacher ? 'inline-block' : 'none'}">❌</button></li>`
                )
                .join("")}
            </ul>
          </div>`
          : `<p><em>No participants yet</em></p>`;
      // Add per-activity registration form for teachers
      const registerForm = isTeacher ? `
        <form class="register-student-form" data-activity="${name}" style="margin-top:10px;">
          <input type="email" name="student-email" required placeholder="Student email" style="padding:6px 8px; border-radius:4px; border:1px solid #ccc; min-width:180px; margin-right:8px;" />
          <button type="submit">Register Student</button>
        </form>
      ` : "";
      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Category:</strong> ${details.category}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
        ${registerForm}
      `;
      activitiesList.appendChild(activityCard);
    });
    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
    // Add event listeners for per-activity register forms
    document.querySelectorAll('.register-student-form').forEach(form => {
      form.addEventListener('submit', handleRegisterStudent);
    });
    userIcon.title = isTeacher ? ('Logged in as ' + (localStorage.getItem('teacherUsername') || 'teacher')) : '';
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: { 'token': localStorage.getItem('teacherToken') }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle per-activity register student form
  async function handleRegisterStudent(event) {
    event.preventDefault();
    const form = event.target;
    const activity = form.getAttribute('data-activity');
    const emailInput = form.querySelector('input[name="student-email"]');
    const email = emailInput.value;
    if (!email) return;
    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: { 'token': localStorage.getItem('teacherToken') }
        }
      );
      const result = await response.json();
      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        form.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to register. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error registering:", error);
    }
  }

  // Animated Git branch lines background
  function animateGitBranches() {
    const bg = document.getElementById('git-branches-bg');
    if (!bg) return;
    bg.innerHTML = '';
    const w = window.innerWidth;
    const h = window.innerHeight;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.style.display = 'block';
    svg.style.width = '100vw';
    svg.style.height = '100vh';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    // Parameters for branches
    const branchCount = 6;
    const colors = ['#b6e62e', '#d4ff37', '#c0ff8c', '#eaffd0'];
    const speed = 0.5 + Math.random();
    const now = Date.now() / 1000;

    for (let i = 0; i < branchCount; i++) {
      const path = document.createElementNS(svgNS, 'path');
      const x0 = 80 + i * (w - 160) / (branchCount - 1);
      let d = `M ${x0} 0`;
      let y = 0;
      let x = x0;
      for (let seg = 1; seg <= 12; seg++) {
        y += h / 12;
        const phase = now * (0.3 + 0.2 * i) + seg * 0.7 * (i + 1);
        x += Math.sin(phase) * 40 * (1 + 0.2 * i);
        d += ` Q ${x + 30} ${y - h / 24}, ${x} ${y}`;
      }
      path.setAttribute('d', d);
      path.setAttribute('stroke', colors[i % colors.length]);
      path.setAttribute('stroke-width', 3 + (i % 2));
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', 0.5);
      svg.appendChild(path);
    }
    bg.appendChild(svg);
  }

  // Animate at 30fps
  setInterval(animateGitBranches, 33);
  window.addEventListener('resize', animateGitBranches);

  // Initialize app
  fetchActivities();
});

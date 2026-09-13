function renderNav(active) {
  const user = Api.getUser();
  const mount = document.getElementById("nav");
  if (!mount || !user) return;

  const links = [
    { key: "dashboard", href: "dashboard.html", label: "แดชบอร์ด" },
    { key: "my-beds", href: "my-beds.html", label: "เตียงของฉัน" },
  ];
  if (user.role === "ADMIN") {
    links.push({ key: "admin", href: "admin-beds.html", label: "จัดการระบบ" });
  }

  mount.innerHTML = `
    <div class="nav-inner">
      <a href="dashboard.html" class="nav-brand">🛡️ Pressure Sore Guard</a>
      <nav class="nav-links">
        ${links
          .map(
            (l) =>
              `<a href="${l.href}" class="nav-link ${active === l.key ? "nav-link-active" : ""}">${l.label}</a>`
          )
          .join("")}
        <span class="nav-user">${user.name}</span>
        <button id="logoutBtn" class="btn btn-secondary">ออกจากระบบ</button>
      </nav>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Api.clearSession();
    location.href = "index.html";
  });
}

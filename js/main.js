// Landing page enhancements (scroll effects only - menu handled by auth.js)
document.addEventListener("DOMContentLoaded", function() {
  // Navbar background on scroll
  var navbar = document.querySelector(".navbar");
  if (navbar) {
    window.addEventListener("scroll", function() {
      if (window.scrollY > 50) {
        navbar.style.background = "rgba(10, 10, 26, 0.95)";
      } else {
        navbar.style.background = "rgba(10, 10, 26, 0.85)";
      }
    });
  }

  // Smooth reveal on scroll
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  document.querySelectorAll(".feature-card, .step, .stat").forEach(function(el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(el);
  });
});

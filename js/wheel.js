const WheelGame = (() => {
  const segments = [
    { label: "100 Pts", color: "#6c5ce7", value: 100 },
    { label: "50 Pts", color: "#00cec9", value: 50 },
    { label: "200 Pts", color: "#e17055", value: 200 },
    { label: "10 Pts", color: "#fdcb6e", value: 10 },
    { label: "500 Pts", color: "#d63031", value: 500 },
    { label: "25 Pts", color: "#0984e3", value: 25 },
    { label: "75 Pts", color: "#00b894", value: 75 },
    { label: "150 Pts", color: "#e84393", value: 150 },
  ];

  let canvas, ctx;
  let currentAngle = 0;
  let spinning = false;
  let spinsLeft = 3;

  function init() {
    canvas = document.getElementById("wheel-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    draw();

    document.getElementById("spin-btn").addEventListener("click", spin);
  }

  function draw() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 5;
    const segmentAngle = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw outer ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 6;
    ctx.stroke();

    segments.forEach((seg, i) => {
      const startAngle = currentAngle + i * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px -apple-system, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, radius - 20, 6);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
    gradient.addColorStop(0, "#1a1a3e");
    gradient.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function spin() {
    if (spinning || spinsLeft <= 0) return;

    spinning = true;
    spinsLeft--;
    document.getElementById("spins-count").textContent = spinsLeft;
    document.getElementById("spin-btn").disabled = true;
    document.getElementById("result-display").classList.add("hidden");

    const spinDuration = 4000;
    const totalRotation = Math.PI * 2 * (5 + Math.random() * 5);
    const startAngle = currentAngle;
    const startTime = performance.now();

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      const easedProgress = easeOut(progress);

      currentAngle = startAngle + totalRotation * easedProgress;
      draw();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        spinning = false;
        showResult();
        if (spinsLeft > 0) {
          document.getElementById("spin-btn").disabled = false;
        }
      }
    }

    requestAnimationFrame(animate);
  }

  function showResult() {
    const segmentAngle = (2 * Math.PI) / segments.length;
    // The pointer is at the top (- PI/2)
    const normalizedAngle = ((2 * Math.PI - (currentAngle % (2 * Math.PI))) + Math.PI / 2) % (2 * Math.PI);
    const winningIndex = Math.floor(normalizedAngle / segmentAngle) % segments.length;
    const winner = segments[winningIndex];

    document.getElementById("result-text").textContent = winner.label;
    document.getElementById("result-display").classList.remove("hidden");

    // Award points if logged in
    if (typeof Auth !== "undefined" && Auth.isLoggedIn()) {
      Auth.addPoints(winner.value);
    }
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", WheelGame.init);

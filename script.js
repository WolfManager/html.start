const ctaButton = document.getElementById("ctaButton");

if (ctaButton) {
  ctaButton.addEventListener("click", () => {
    ctaButton.textContent = "Perfect, functioneaza!";
    ctaButton.disabled = true;
  });
}

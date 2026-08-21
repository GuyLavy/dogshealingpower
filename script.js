(() => {
  "use strict";

  const select = (selector, root = document) => root.querySelector(selector);
  const selectAll = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  initialiseNavigation();
  initialiseCarousels();
  setCurrentYear();

  function initialiseNavigation() {
    const toggle = select(".nav-toggle");
    const navigation = select(".site-nav");

    if (!toggle || !navigation) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "סגירת תפריט" : "פתיחת תפריט");
      navigation.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navigation.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        navigation.classList.contains("is-open") &&
        !navigation.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        setOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 880) setOpen(false);
    });
  }

  function initialiseCarousels() {
    selectAll("[data-carousel]").forEach(initialiseCarousel);
  }

  function initialiseCarousel(root) {
    const slides = selectAll("[data-slide]", root);
    const previousButton = select("[data-prev]", root);
    const nextButton = select("[data-next]", root);
    const toggleButton = select("[data-toggle]", root);
    const dotsContainer = select("[data-dots]", root);

    if (slides.length === 0) {
      root.hidden = true;
      return;
    }

    if (!previousButton || !nextButton || !toggleButton || !dotsContainer) {
      console.warn("Carousel controls are incomplete.", root);
      return;
    }

    const interval = normaliseInterval(root.dataset.interval);
    const requestedAutoplay = root.dataset.autoplay === "true";
    const isRtl = document.documentElement.dir === "rtl";

    let currentIndex = Math.max(
      0,
      slides.findIndex((slide) => slide.classList.contains("is-active"))
    );
    let timerId = null;
    let userPaused = false;
    let pointerPaused = false;
    let focusPaused = false;
    let pointerStart = null;

    const dots = slides.map((slide, index) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${index + 1} מתוך ${slides.length}`);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `מעבר לשקופית ${index + 1}`);
      dot.addEventListener("click", () => {
        showSlide(index);
        restartAutoplay();
      });
      dotsContainer.append(dot);
      return dot;
    });

    dotsContainer.setAttribute("role", "group");
    root.dataset.singleSlide = String(slides.length < 2);

    if (slides.length < 2) userPaused = true;

    const autoplayAvailable = () =>
      requestedAutoplay &&
      slides.length > 1 &&
      !reducedMotion.matches;

    const autoplayAllowed = () => autoplayAvailable() && !document.hidden;
    const temporarilyPaused = () => pointerPaused || focusPaused;

    const stopAutoplay = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (!autoplayAllowed() || userPaused || temporarilyPaused()) return;

      timerId = window.setInterval(() => {
        showSlide(currentIndex + 1);
      }, interval);
    };

    const restartAutoplay = () => {
      stopAutoplay();
      startAutoplay();
    };

    const updateToggleButton = () => {
      const appearsPaused = userPaused || !autoplayAllowed();
      toggleButton.classList.toggle("is-paused", appearsPaused);
      toggleButton.setAttribute(
        "aria-label",
        appearsPaused
          ? "הפעלת ההחלפה האוטומטית"
          : "עצירת ההחלפה האוטומטית"
      );
      toggleButton.hidden = !autoplayAvailable();
    };

    const showSlide = (nextIndex) => {
      currentIndex = (nextIndex + slides.length) % slides.length;

      slides.forEach((slide, index) => {
        const active = index === currentIndex;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
        if ("inert" in slide) slide.inert = !active;
      });

      dots.forEach((dot, index) => {
        const active = index === currentIndex;
        dot.setAttribute("aria-current", String(active));
      });

      selectAll("img", slides[currentIndex]).forEach((image) => {
        image.loading = "eager";
      });
    };

    const moveBy = (step) => {
      showSlide(currentIndex + step);
      restartAutoplay();
    };

    previousButton.addEventListener("click", () => moveBy(-1));
    nextButton.addEventListener("click", () => moveBy(1));

    toggleButton.addEventListener("click", () => {
      if (!requestedAutoplay || slides.length < 2) return;

      userPaused = !userPaused;
      updateToggleButton();

      if (userPaused) stopAutoplay();
      else startAutoplay();
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveBy(isRtl ? 1 : -1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveBy(isRtl ? -1 : 1);
      }
    });

    root.addEventListener("pointerenter", () => {
      pointerPaused = true;
      stopAutoplay();
    });

    root.addEventListener("pointerleave", () => {
      pointerPaused = false;
      startAutoplay();
    });

    root.addEventListener("focusin", () => {
      focusPaused = true;
      stopAutoplay();
    });

    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) {
        focusPaused = false;
        startAutoplay();
      }
    });

    root.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      pointerStart = {
        x: event.clientX,
        y: event.clientY
      };
    });

    root.addEventListener("pointerup", (event) => {
      if (!pointerStart) return;

      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      pointerStart = null;

      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

      const movedTowardLeft = deltaX < 0;
      const step = movedTowardLeft
        ? (isRtl ? -1 : 1)
        : (isRtl ? 1 : -1);

      moveBy(step);
    });

    root.addEventListener("pointercancel", () => {
      pointerStart = null;
    });

    document.addEventListener("visibilitychange", () => {
      updateToggleButton();
      startAutoplay();
    });

    const handleMotionPreferenceChange = () => {
      updateToggleButton();
      startAutoplay();
    };

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", handleMotionPreferenceChange);
    } else {
      reducedMotion.addListener(handleMotionPreferenceChange);
    }

    showSlide(currentIndex);
    updateToggleButton();
    startAutoplay();
  }

  function normaliseInterval(value) {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed)) return 6500;
    return Math.min(Math.max(parsed, 4000), 20000);
  }

  function setCurrentYear() {
    const year = select("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }
})();

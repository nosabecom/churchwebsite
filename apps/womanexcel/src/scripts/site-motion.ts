const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");

const reveal = (element: Element, kind = "up") => {
    if (!(element instanceof HTMLElement) || element.dataset.reveal) return;
    element.dataset.reveal = kind;
};

const revealChildren = (selector: string, kind = "up") => {
    document.querySelectorAll<HTMLElement>(selector).forEach((container) => {
        Array.from(container.children).forEach((child, index) => {
            reveal(child, kind);
            if (child instanceof HTMLElement) {
                child.style.setProperty("--motion-delay", `${Math.min(index, 6) * 75}ms`);
            }
        });
    });
};

const initialiseMotion = () => {
    if (document.documentElement.dataset.motionInitialised) return;
    document.documentElement.dataset.motionInitialised = "true";

    const nav = document.querySelector<HTMLElement>("body > nav");
    nav?.setAttribute("data-motion-nav", "");

    const introTargets = document.querySelectorAll<HTMLElement>([
        ".cew-cinematic-hero__content > *",
        ".conference-archive-hero__content > *",
        ".conference-cinema-hero__content > *",
        ".cew-contact__hero > *",
        ".cew-newsletters__masthead > *",
    ].join(","));

    introTargets.forEach((element, index) => {
        element.dataset.motionIntro = "";
        element.dataset.motionKind = element.matches("h1, h2") ? "headline" : "up";
        element.style.setProperty("--motion-delay", `${Math.min(index, 5) * 95}ms`);
    });

    [
        ".cew-editorial__intro",
        ".cew-story-grid__copy",
        ".cew-mission__heading",
        ".cew-scripture__inner",
        ".cew-conference-feature__card",
        ".cew-join__inner",
        ".conference-archive-intro",
        ".conference-section-heading",
        ".conference-story__intro",
        ".conference-story__copy",
        ".conference-year-intro__copy",
        ".conference-gallery__heading",
        ".conference-speakers__heading",
        ".conference-recap__copy",
        ".conference-mailing__inner",
        ".cew-newsletters__latest-copy",
        ".cew-newsletters__archive > header",
        ".cew-newsletter-article__copy",
        ".cew-newsletter-article__body",
        ".cew-contact__body > div",
        ".cew-contact__body > aside",
    ].forEach((selector) => revealChildren(selector));

    [
        ".cew-pillar-list",
        ".conference-year-list",
        ".conference-schedule__list",
        ".conference-programme__grid",
        ".conference-gallery__grid",
        ".conference-recap__media",
        ".cew-newsletters__archive > ol",
    ].forEach((selector) => revealChildren(selector));

    document.querySelectorAll<HTMLElement>([
        ".cew-story-grid__main",
        ".cew-story-grid__small",
        ".cew-conference-feature__media",
        ".conference-story__grid figure",
        ".conference-year-intro__media",
        ".cew-newsletters__cover",
        ".cew-newsletter-article__cover",
    ].join(",")).forEach((element) => reveal(element, "image"));

    const parallaxMedia = document.querySelectorAll<HTMLElement>([
        ".cew-story-grid figure",
        ".cew-conference-feature__media",
        ".conference-year-card",
        ".conference-story__grid figure",
        ".conference-year-intro__media",
        ".conference-programme figure",
        ".conference-gallery__grid a",
        ".conference-gallery__grid figure",
        ".conference-recap__media li",
        ".cew-newsletters__cover",
        ".cew-newsletters__archive-cover",
        ".cew-newsletter-article__cover",
    ].join(","));
    parallaxMedia.forEach((element) => element.setAttribute("data-motion-parallax", ""));

    const revealTargets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
        revealTargets.forEach((element) => element.classList.add("is-visible"));
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
        revealTargets.forEach((element) => observer.observe(element));
    }

    document.documentElement.dataset.motionReady = "true";
    requestAnimationFrame(() => {
        nav?.classList.add("is-visible");
        introTargets.forEach((element) => element.classList.add("is-visible"));
    });

    if (reducedMotion.matches) return;

    const heroes = document.querySelectorAll<HTMLElement>(
        ".cew-cinematic-hero, .conference-archive-hero, .conference-cinema-hero",
    );
    let lastScrollY = window.scrollY;
    let frame = 0;

    const updateScrollMotion = () => {
        frame = 0;
        const viewportHeight = Math.max(window.innerHeight, 1);
        const pageRange = Math.max(document.documentElement.scrollHeight - viewportHeight, 1);
        const scrollY = window.scrollY;

        document.documentElement.style.setProperty("--motion-page-progress", String(clamp(scrollY / pageRange)));

        heroes.forEach((hero) => {
            const rect = hero.getBoundingClientRect();
            const progress = clamp(-rect.top / Math.max(rect.height, viewportHeight));
            hero.style.setProperty("--motion-hero-progress", progress.toFixed(4));
        });

        parallaxMedia.forEach((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > viewportHeight + 100) return;
            const centerOffset = (rect.top + rect.height / 2 - viewportHeight / 2) / (viewportHeight + rect.height);
            element.style.setProperty("--motion-parallax-y", `${clamp(centerOffset * -70, -28, 28).toFixed(2)}px`);
        });

        if (nav) {
            nav.toggleAttribute("data-nav-scrolled", scrollY > 20);
            const movingDown = scrollY > lastScrollY + 5;
            const movingUp = scrollY < lastScrollY - 5;
            if (movingDown && scrollY > 180) nav.setAttribute("data-nav-hidden", "");
            if (movingUp || scrollY < 90) nav.removeAttribute("data-nav-hidden");
        }
        lastScrollY = scrollY;
    };

    const requestScrollUpdate = () => {
        if (!frame) frame = requestAnimationFrame(updateScrollMotion);
    };
    updateScrollMotion();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });

    if (finePointer.matches) {
        document.addEventListener("pointermove", (event) => {
            document.documentElement.style.setProperty("--motion-pointer-x", `${event.clientX}px`);
            document.documentElement.style.setProperty("--motion-pointer-y", `${event.clientY}px`);
        }, { passive: true });

        document.querySelectorAll<HTMLElement>(
            ".cew-button, .conference-button, .cew-site-nav__cta",
        ).forEach((element) => {
            element.setAttribute("data-magnetic", "");
            element.addEventListener("pointermove", (event) => {
                const rect = element.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                element.style.setProperty("--motion-magnetic-x", `${x * 7}px`);
                element.style.setProperty("--motion-magnetic-y", `${y * 5}px`);
                element.style.setProperty("--motion-shine-x", `${(x + 0.5) * 100}%`);
                element.style.setProperty("--motion-shine-y", `${(y + 0.5) * 100}%`);
            });
            element.addEventListener("pointerleave", () => {
                element.style.removeProperty("--motion-magnetic-x");
                element.style.removeProperty("--motion-magnetic-y");
            });
        });

        document.querySelectorAll<HTMLElement>(
            ".conference-gallery__grid li, .cew-newsletters__archive li",
        ).forEach((element) => {
            element.setAttribute("data-motion-tilt", "");
            element.addEventListener("pointermove", (event) => {
                const rect = element.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                element.style.setProperty("--motion-tilt-x", `${y * -2.5}deg`);
                element.style.setProperty("--motion-tilt-y", `${x * 3}deg`);
            });
            element.addEventListener("pointerleave", () => {
                element.style.removeProperty("--motion-tilt-x");
                element.style.removeProperty("--motion-tilt-y");
            });
        });
    }
};

initialiseMotion();

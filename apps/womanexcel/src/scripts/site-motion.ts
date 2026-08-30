const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");

const splitHeadingIntoWords = (heading: HTMLElement) => {
    if (heading.dataset.motionWords) return;

    const accessibleLabel = heading.textContent?.replace(/\s+/g, " ").trim();
    if (accessibleLabel) heading.setAttribute("aria-label", accessibleLabel);

    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    let wordIndex = 0;
    textNodes.forEach((textNode) => {
        const fragment = document.createDocumentFragment();
        (textNode.textContent ?? "").split(/(\s+)/).forEach((part) => {
            if (!part || /^\s+$/.test(part)) {
                fragment.append(part);
                return;
            }

            const mask = document.createElement("span");
            const word = document.createElement("span");
            mask.className = "motion-word-mask";
            word.className = "motion-word";
            word.textContent = part;
            word.setAttribute("aria-hidden", "true");
            word.style.setProperty("--motion-word-delay", `${Math.min(wordIndex, 12) * 42}ms`);
            mask.append(word);
            fragment.append(mask);
            wordIndex += 1;
        });
        textNode.replaceWith(fragment);
    });

    heading.dataset.motionWords = "";
};

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
        if (element.closest(".cew-cinematic-hero, .conference-archive-hero, .conference-cinema-hero")) {
            element.dataset.motionHeroCopy = "";
        }
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

    const kineticHeadlines = document.querySelectorAll<HTMLElement>("main h1, main h2");
    kineticHeadlines.forEach((heading, index) => {
        if (!heading.dataset.reveal && !heading.dataset.motionIntro) reveal(heading);
        splitHeadingIntoWords(heading);
        heading.dataset.motionKinetic = "";
        heading.style.setProperty("--motion-kinetic-direction", index % 2 === 0 ? "1" : "-1");
    });

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

    const motionCards = document.querySelectorAll<HTMLElement>(
        ".conference-gallery__grid li, .cew-newsletters__archive li",
    );
    motionCards.forEach((element, index) => {
        element.dataset.motionCard = "";
        element.style.setProperty("--motion-card-rotation", `${(index % 2 === 0 ? -1 : 1) * (1.1 + (index % 3) * 0.45)}deg`);
    });

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

        const clippedRevealTargets = Array.from(revealTargets).filter(
            (element) => element.dataset.reveal === "image",
        );
        let revealFrame = 0;

        // A fully clipped element has a zero intersection area in Chromium, so it
        // cannot wake its own IntersectionObserver. Measure the unclipped layout
        // box for image masks and let the observer handle every other reveal.
        const revealClippedMedia = () => {
            revealFrame = 0;
            const viewportBottom = window.innerHeight * 0.94;

            clippedRevealTargets.forEach((element) => {
                if (element.classList.contains("is-visible")) return;
                const rect = element.getBoundingClientRect();
                if (rect.top < viewportBottom && rect.bottom > 0) {
                    element.classList.add("is-visible");
                }
            });
        };
        const scheduleClippedMediaReveal = () => {
            if (revealFrame) return;
            revealFrame = window.requestAnimationFrame(revealClippedMedia);
        };

        revealTargets.forEach((element) => {
            if (element.dataset.reveal !== "image") observer.observe(element);
        });
        revealClippedMedia();
        window.addEventListener("scroll", scheduleClippedMediaReveal, { passive: true });
        window.addEventListener("resize", scheduleClippedMediaReveal);
    }

    document.documentElement.dataset.motionReady = "true";
    window.setTimeout(() => requestAnimationFrame(() => {
        nav?.classList.add("is-visible");
        introTargets.forEach((element) => element.classList.add("is-visible"));
    }), reducedMotion.matches ? 0 : 480);

    if (reducedMotion.matches) return;

    const heroes = document.querySelectorAll<HTMLElement>(
        ".cew-cinematic-hero, .conference-archive-hero, .conference-cinema-hero",
    );
    const motionOrnaments = document.querySelectorAll<HTMLElement>(
        ".cew-mission__ghost, .conference-recap__year",
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

        kineticHeadlines.forEach((heading) => {
            const rect = heading.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > viewportHeight + 100) return;
            const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height));
            const direction = Number(heading.style.getPropertyValue("--motion-kinetic-direction")) || 1;
            heading.style.setProperty("--motion-headline-x", `${((progress - 0.5) * 46 * direction).toFixed(2)}px`);
        });

        parallaxMedia.forEach((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > viewportHeight + 100) return;
            const centerOffset = (rect.top + rect.height / 2 - viewportHeight / 2) / (viewportHeight + rect.height);
            element.style.setProperty("--motion-parallax-y", `${clamp(centerOffset * -70, -28, 28).toFixed(2)}px`);
        });

        motionCards.forEach((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > viewportHeight + 100) return;
            const centerOffset = clamp((rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight, -1, 1);
            element.style.setProperty("--motion-card-y", `${(centerOffset * -18).toFixed(2)}px`);
            element.style.setProperty("--motion-card-scale", String(1 - Math.abs(centerOffset) * 0.035));
        });

        motionOrnaments.forEach((element) => {
            const section = element.parentElement;
            if (!section) return;
            const rect = section.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > viewportHeight + 100) return;
            const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height));
            element.style.setProperty("--motion-ornament-x", `${((progress - 0.5) * 90).toFixed(2)}px`);
            element.style.setProperty("--motion-ornament-rotate", `${((progress - 0.5) * 3).toFixed(2)}deg`);
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

    const curtain = document.querySelector<HTMLElement>("[data-motion-curtain]");
    document.addEventListener("click", (event) => {
        if (!(event instanceof MouseEvent) || event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
        if (!link || link.target || link.hasAttribute("download")) return;

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
        if (!curtain || curtain.hasAttribute("data-exit")) return;

        event.preventDefault();
        try { sessionStorage.setItem("cew-motion-navigation", "1"); } catch {}
        curtain.setAttribute("data-exit", "");
        window.setTimeout(() => window.location.assign(destination.href), 460);
    });

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) curtain?.removeAttribute("data-exit");
    });

    if (finePointer.matches) {
        const cursor = document.querySelector<HTMLElement>("[data-motion-cursor]");
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

        motionCards.forEach((element) => {
            element.setAttribute("data-motion-tilt", "");
            const cursorLabel = element.closest(".cew-newsletters__archive") ? "Read" : "View";
            element.addEventListener("pointerenter", () => {
                if (!cursor) return;
                cursor.querySelector("span")!.textContent = cursorLabel;
                cursor.setAttribute("data-active", "");
            });
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
                cursor?.removeAttribute("data-active");
            });
        });
    }
};

initialiseMotion();

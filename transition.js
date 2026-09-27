document.addEventListener("DOMContentLoaded", () => {
const loader = document.querySelector(".page-loader");
const skeletonMain = document.querySelector("#skeleton-main");


if (!loader || !skeletonMain) return;

/*
 * Build the skeleton for the destination page.
 */
function buildSkeleton(page) {
    skeletonMain.innerHTML = "";

    if (page.includes("database")) {
        skeletonMain.className = "skeleton-main skeleton-database";

        skeletonMain.innerHTML = `
            <span class="skeleton-block skeleton-title"></span>

            <span class="skeleton-block skeleton-search"></span>

            <span class="skeleton-block skeleton-row"></span>
            <span class="skeleton-block skeleton-row"></span>
            <span class="skeleton-block skeleton-row"></span>
            <span class="skeleton-block skeleton-row"></span>
            <span class="skeleton-block skeleton-row"></span>
        `;

        return;
    }

    if (page.includes("community")) {
        skeletonMain.className = "skeleton-main skeleton-community";

        skeletonMain.innerHTML = `
            <span class="skeleton-block skeleton-title"></span>

            <span class="skeleton-block skeleton-post"></span>
            <span class="skeleton-block skeleton-post"></span>
            <span class="skeleton-block skeleton-post"></span>
        `;

        return;
    }

    if (page.includes("arcade")) {
        skeletonMain.className = "skeleton-main skeleton-arcade";

        skeletonMain.innerHTML = `
            <span class="skeleton-block skeleton-title"></span>

            <div class="skeleton-games">
                <span class="skeleton-block skeleton-game"></span>
                <span class="skeleton-block skeleton-game"></span>
                <span class="skeleton-block skeleton-game"></span>
                <span class="skeleton-block skeleton-game"></span>
                <span class="skeleton-block skeleton-game"></span>
                <span class="skeleton-block skeleton-game"></span>
            </div>
        `;

        return;
    }

    /*
     * Main page skeleton
     */
    skeletonMain.className = "skeleton-main";

    skeletonMain.innerHTML = `
        <span class="skeleton-block skeleton-title"></span>

        <span class="skeleton-block skeleton-text"></span>
        <span class="skeleton-block skeleton-text short"></span>
    `;
}

/*
 * Hide the skeleton once the current page has loaded.
 */
requestAnimationFrame(() => {
    loader.classList.remove("is-loading");
});

/*
 * Intercept internal navigation.
 */
document.querySelectorAll("a[href]").forEach(link => {
    link.addEventListener("click", event => {
        const href = link.getAttribute("href");

        if (
            !href ||
            href.startsWith("#") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:") ||
            link.target === "_blank" ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        const destination = new URL(
            link.href,
            window.location.href
        );

        if (destination.origin !== window.location.origin) {
            return;
        }

        event.preventDefault();

        /*
         * Determine the destination page.
         */
        const pathname = destination.pathname.toLowerCase();

        buildSkeleton(pathname);

        /*
         * Show skeleton.
         */
        loader.classList.add("is-loading");

        /*
         * Give the skeleton a moment to appear
         * before navigating.
         */
        setTimeout(() => {
            window.location.href = destination.href;
        }, 220);
    });
});


});

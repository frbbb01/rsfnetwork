document.addEventListener("DOMContentLoaded", () => {
const loader = document.querySelector(".page-loader");


if (!loader) return;

// Hide loader when the page loads
requestAnimationFrame(() => {
    loader.classList.remove("is-loading");
});

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

        const destination = new URL(link.href, window.location.href);

        // Only animate internal page navigation
        if (destination.origin !== window.location.origin) {
            return;
        }

        event.preventDefault();

        loader.classList.add("is-loading");

        setTimeout(() => {
            window.location.href = destination.href;
        }, 220);
    });
});


});

const ValidThemes = [
"dark",
"light",
"blue",
"royal",
"ocean"
];

const ThemeDiff = {
dark: {
background: "#181818"
},

light: {
background:
"radial-gradient(900px 620px at 78% 2%, rgba(42,103,175,.12), transparent 68%), radial-gradient(760px 560px at 8% 55%, rgba(25,75,145,.08), transparent 70%), radial-gradient(650px 480px at 55% 105%, rgba(20,65,125,.06), transparent 72%), #F4F6F9"
},

blue: {
background:
"radial-gradient(900px 620px at 78% 2%, rgba(42,103,175,.34), transparent 68%), radial-gradient(760px 560px at 8% 55%, rgba(25,75,145,.18), transparent 70%), radial-gradient(650px 480px at 55% 105%, rgba(20,65,125,.13), transparent 72%), #0B1220"
},

royal: {
background:
"radial-gradient(900px 620px at 78% 2%, rgba(90,60,180,.34), transparent 68%), radial-gradient(760px 560px at 8% 55%, rgba(65,45,150,.18), transparent 70%), radial-gradient(650px 480px at 55% 105%, rgba(50,35,130,.13), transparent 72%), #0B1020"
},

ocean: {
background:
"radial-gradient(900px 620px at 78% 2%, rgba(20,145,160,.34), transparent 68%), radial-gradient(760px 560px at 8% 55%, rgba(15,110,130,.18), transparent 70%), radial-gradient(650px 480px at 55% 105%, rgba(10,90,110,.13), transparent 72%), #08171D"
}
};

function applyThemeDiff(theme) {
if (!ValidThemes.includes(theme)) {
theme = "blue";
}

const themeData =
ThemeDiff[theme];

if (!themeData) {
return;
}

document.documentElement.style.background =
themeData.background;

document.body.style.background =
themeData.background;
}

function getCurrentTheme() {
const theme =
document.body.dataset.theme;

if (ValidThemes.includes(theme)) {
return theme;
}

return "blue";
}

function syncThemeDiff() {
applyThemeDiff(
getCurrentTheme()
);
}

document.addEventListener(
"DOMContentLoaded",
syncThemeDiff
);

window.addEventListener(
"storage",
event => {
if (event.key !== "rsf-theme") {
return;
}


if (
  event.newValue &&
  ValidThemes.includes(event.newValue)
) {
  applyThemeDiff(
    event.newValue
  );
}


}
);

const ThemeDiffObserver =
new MutationObserver(
mutations => {
for (const mutation of mutations) {
if (
mutation.type === "attributes" &&
mutation.attributeName ===
"data-theme"
) {
syncThemeDiff();
break;
}
}
}
);

if (document.body) {
ThemeDiffObserver.observe(
document.body,
{
attributes: true,
attributeFilter: [
"data-theme"
]
}
);
}

// Phones use the full-page demo rather than a nested interactive scroll area.
const narrow = matchMedia('(max-width:600px)');
function update() {
  for (const frame of document.querySelectorAll('.native-app-demo iframe')) {
    frame.inert = narrow.matches;
    if (narrow.matches) frame.setAttribute('tabindex', '-1');
    else frame.removeAttribute('tabindex');
  }
}
narrow.addEventListener('change', update);
update();

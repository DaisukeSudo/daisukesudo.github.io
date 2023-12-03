import { main as scene1 } from "./scene1.js";
import { main as scene2 } from "./scene2.js";

let stop = null;

const run = (fn) => {
  stop && stop();
  const view = document.querySelector(".view");
  while (view.firstChild) {
    view.removeChild(view.firstChild);
  }
  stop = fn(view);
};

window.onload = () => {
  const command = document.querySelector('.command');
  [
    ['scene1', 'Debug Mode', scene1],
    ['scene2', 'With Three-D', scene2],
  ].forEach(([id, text, fn]) => {
    const button = document.createElement('button');
    button.id = id;
    button.innerText = text;
    button.addEventListener('click', () => run(fn))
    command.appendChild(button);
  });
  run(scene2);
};

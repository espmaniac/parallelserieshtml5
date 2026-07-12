const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const canvasMetrics = {
  width: 0,
  height: 0,
  pixelRatio: 1
};

function getCanvasWidth() {
  return canvasMetrics.width;
}

function getCanvasHeight() {
  return canvasMetrics.height;
}

function getCanvasPixelRatio() {
  return canvasMetrics.pixelRatio;
}

function resizeSchemeElement() {
  const input = document.getElementById("inp");
  const saveHeight = input.style.height;
  input.style.height = "auto";

  const expression = document.getElementById("expression");
  const expressionHeight = expression ? expression.offsetHeight : 0;
  const scheme = document.getElementById("scheme");
  scheme.style.height =  (window.innerHeight - expressionHeight) + "px";
  input.style.height = saveHeight;
}

function resizeCanvas() {
  const expressionHeight = document.getElementById("expression").getBoundingClientRect().height;
  const schemeHeight = document.getElementById("scheme").getBoundingClientRect().height;
  canvasMetrics.width = window.innerWidth;
  canvasMetrics.height = schemeHeight + expressionHeight;
  canvasMetrics.pixelRatio = Math.max(1, window.devicePixelRatio || 1);

  canvas.style.width = canvasMetrics.width + "px";
  canvas.style.height = canvasMetrics.height + "px";

  canvas.width = Math.round(canvasMetrics.width * canvasMetrics.pixelRatio);
  canvas.height = Math.round(canvasMetrics.height * canvasMetrics.pixelRatio);

  ctx.setTransform(canvasMetrics.pixelRatio, 0, 0, canvasMetrics.pixelRatio, 0, 0);
}

resizeCanvas();
resizeSchemeElement();

var choosenComponent = {name: "", shortName: "", defaultValue: "", icon_src: ""};


var cursor =  {
  touches: null,
  offsetX: 0,
  offsetY: 0,
  lastTouches: {}
};


window.onload = function() {
  context_menu.element = document.getElementById("contextMenu");
  context_menu.main_menu.element = document.getElementById("ctxUL");
  
  
  canvas.addEventListener('wheel', toolmgr.onMouseWheel);
  canvas.addEventListener('mousedown', toolmgr.onMouseDown);
  canvas.addEventListener('mouseup', toolmgr.onMouseUp);
  canvas.addEventListener('mousemove', toolmgr.onMouseMove);

  canvas.addEventListener("touchend", toolmgr.onTouchEnd);

  canvas.addEventListener("touchstart", toolmgr.onTouchStart);
  canvas.addEventListener("touchmove", toolmgr.onTouchMove);

  
  canvas.addEventListener("mouseleave", function (event) {
    scheme.isMouseHover = false;
  }, false);

  canvas.addEventListener("mouseover", function (event) {
    scheme.isMouseHover = true;
  }, false);

  window.addEventListener("keydown", toolmgr.onKeyDown);


  window.onresize = function() {
    let windowDifX = (window.innerWidth - getCanvasWidth()) / 2;
    let windowDifY = (window.innerHeight - getCanvasHeight()) / 2;
    scheme.offsetX += windowDifX / scheme.zoom;
    scheme.offsetY += windowDifY / scheme.zoom;

    resizeSchemeElement();
    resizeCanvas();
    
    if (!context_menu.hidden()) {
      let pos = context_menu.element.getBoundingClientRect();

      let x = pos.left + windowDifX;
      
      let y = pos.top + windowDifY;

      context_menu.setPos(x, y);
    }

    scheme.renderAll();
  };



  canvas.addEventListener("contextmenu", toolmgr.onContextMenu);
  
  let input = document.getElementById("inp");

  resizeCanvas();
  
  input.oninput = function() {
    textAreaAutoHeight();
  }

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
    scheme.renderAll();
    resizeSchemeElement();
  });

  resizeObserver.observe(input);

  initComponents();

  initTools();


  initModals();
  
  var btnClear = document.getElementById("clear");
  btnClear.addEventListener("click", function() {
    let del = confirm("Do you want to clear the circuit?");
    
    if (del) scheme.clear();

    scheme.renderAll();
  });


  document.getElementById("calc").onclick = function() {
    evaluateExpression(document.getElementById("inp").value);
  };


  document.getElementById("calculate").addEventListener("click", function(e) {
    solveCircuitWithSelectedMethod(true);
  });


  document.getElementById("equivalent").addEventListener("click", function(e) {
    // Ensure both labels are attached to nodes
    if (!scheme.labels[0].node || !scheme.labels[1].node) return;

    // Remove previously auto-added graph labels (if any)
    const deletePrevNodes = new MacroCommand();
    for (let i = 2; i < scheme.labels.length; ++i) {
      deletePrevNodes.addCommand(new DeleteElement(scheme.labels[i]));
    }
    if (scheme.labels.length > 2) {
      scheme.execute(deletePrevNodes);
    }

    // Compute equivalent value numerically
    const eqv = new Equivalent();
    const eq = eqv.computeEquivalent(scheme.labels[0].node, scheme.labels[1].node);

    document.getElementById("inp").scrollIntoView();

    // Render the answer
    const res = document.getElementById("result");
    if (eq == null) {
      res.innerText = "Answer: error";
      return;
    }
    res.innerText = "Answer: " + eq;
  });

  scheme.renderAll();
}

function evaluateExpression(expression) {
  const parser = new ParallelSeries();
  parser.onSeries = onSeries;
  parser.onParallel = onParallel;
  parser.expr = expression;

  const value = parser.solve();
  const answer = parser.lexer.fail ? "error" : String(value);
  document.getElementById("result").innerText = "Answer: " + answer;
  return {
    success: !parser.lexer.fail,
    value: value,
    answer: answer
  };
}

function removeGeneratedGraphLabels() {
  const deletePrevNodes = new MacroCommand();
  for (let i = 2; i < scheme.labels.length; ++i) {
    deletePrevNodes.addCommand(new DeleteElement(scheme.labels[i]));
  }
  if (scheme.labels.length > 2) scheme.execute(deletePrevNodes);
}

function selectedSolutionMethodId() {
  const select = document.getElementById("solutionMethodSelect");
  if (select && select.value) return select.value;

  const methods = solutionMethodRegistry.list();
  return methods.length > 0 ? methods[0].id : "";
}

function solveCircuitWithSelectedMethod(scrollToExpression) {
  const methodId = selectedSolutionMethodId();
  const method = solutionMethodRegistry.get(methodId);
  let solution;
  let answer = "error";

  if (!scheme.labels[0].node || !scheme.labels[1].node) {
    solution = {
      expression: null,
      componentExpression: null,
      steps: [{
        type: "error",
        title: "Missing terminals",
        description: "Assign both StartNode and DestNode before solving the circuit.",
        before: null,
        after: null
      }]
    };
  } else {
    removeGeneratedGraphLabels();
    solution = solutionMethodRegistry.solve(
      methodId,
      scheme.labels[0].node,
      scheme.labels[1].node
    );

    if (solution.answer !== undefined && solution.answer !== null) {
      answer = String(solution.answer);
    }

    if (solution.expression) {
      const input = document.getElementById("inp");
      if (scrollToExpression) input.scrollIntoView();
      input.value = solution.expression;
      textAreaAutoHeight();
      resizeCanvas();
      answer = evaluateExpression(solution.expression).answer;
    }
  }

  if (!solution.expression) {
    document.getElementById("result").innerText = "Answer: " + answer;
  }

  renderSolutionModal(method, solution, answer);
  const modal = document.getElementById("solutionModal");
  modal.style.display = "flex";
  const closeButton = modal.querySelector(".close");
  if (closeButton) closeButton.focus();
}

function renderSolutionModal(method, solution, answer) {
  const description = document.getElementById("solutionMethodDescription");
  description.textContent = method ? method.description : "No solution method is available.";

  const componentExpression = document.getElementById("solutionComponentExpression");
  componentExpression.textContent = solution.componentExpression || "Not available";

  const expression = document.getElementById("solutionExpression");
  expression.textContent = solution.expression || "Not available";

  const answerElement = document.getElementById("solutionAnswer");
  answerElement.textContent = answer;

  const stepsElement = document.getElementById("solutionSteps");
  stepsElement.replaceChildren();

  const steps = solution.steps || [];
  for (let i = 0; i < steps.length; ++i) {
    const step = steps[i];
    const item = document.createElement("li");
    item.className = "solutionStep";
    item.dataset.stepType = step.type || "analysis";

    const heading = document.createElement("div");
    heading.className = "solutionStepHeading";

    const number = document.createElement("span");
    number.className = "solutionStepNumber";
    number.textContent = String(i + 1);

    const title = document.createElement("h5");
    title.textContent = step.title;

    heading.append(number, title);
    item.appendChild(heading);

    const details = document.createElement("p");
    details.textContent = step.description;
    item.appendChild(details);

    if (step.before || step.after) {
      const equation = document.createElement("div");
      equation.className = "solutionEquation";

      if (step.before) {
        const before = document.createElement("code");
        before.textContent = step.before;
        equation.appendChild(before);
      }

      if (step.before && step.after) {
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.setAttribute("aria-hidden", "true");
        equation.appendChild(arrow);
      }

      if (step.after) {
        const after = document.createElement("code");
        after.textContent = step.after;
        equation.appendChild(after);
      }

      item.appendChild(equation);
    }

    stepsElement.appendChild(item);
  }
}

function textAreaAutoHeight() {     
  const input = document.getElementById("inp");
    if (parseInt(input.offsetHeight) <= parseInt(input.scrollHeight))
        input.style.height = (input.scrollHeight) + "px"; 
}

function initComponents() {
  const selectionClass = "component-selecting";
  document.documentElement.classList.add(selectionClass);
  document.body.classList.add(selectionClass);

  let chooseComponent = document.getElementById("chooseComponent");

  function closeChooseComponent() {
    document.documentElement.classList.remove(selectionClass);
    document.body.classList.remove(selectionClass);

    if (chooseComponent && chooseComponent.parentNode) {
      chooseComponent.parentNode.removeChild(chooseComponent);
    }
  }
  let chooseResistor = document.getElementById("resistor");
  let chooseCapactitor = document.getElementById("capacitor");
  let chooseInductor = document.getElementById("inductor");

  function bindLegacyTap(element, action) {
    if (!element) {
      return;
    }

    let touchHandled = false;

    element.addEventListener("touchend", function(e) {
      touchHandled = true;
      e.preventDefault();
      action();
      setTimeout(function() {
        touchHandled = false;
      }, 400);
    });

    element.addEventListener("click", function() {
      if (touchHandled) {
        return;
      }
      action();
    });
  }

  bindLegacyTap(chooseResistor, function() {
    selectComponent("R");
    closeChooseComponent();
  });

  bindLegacyTap(chooseCapactitor, function() {
    selectComponent("C");
    closeChooseComponent();
  });
  
  bindLegacyTap(chooseInductor, function() {
    selectComponent("L");
    closeChooseComponent();
  });

  let open = document.getElementById("open");
  bindLegacyTap(open, function() {
    scheme.deserialize(document.getElementById("openScheme").value);
    closeChooseComponent();
  });

}

function removeActive() {
  let mainTools = document.getElementById("mainTools");

  for (let i = 0; i < mainTools.children.length; ++i) {
    mainTools.children[i].classList.remove("active");
  }

}

function initTools() {
  let cursorTool = document.getElementById("cursorTool");
  let wireTool = document.getElementById("wireTool");

  cursorTool.addEventListener("click", function() {
    removeActive();
    this.classList.add("active");
    scheme.tool = "SELECT";
  });

  
  wireTool.addEventListener("click", function() {
    scheme.tool = "WIRE";
    removeActive();
    this.classList.add("active");
  });

}

function selectComponent(shortName) {
  switch(shortName) {
    case "R":
      choosenComponent = {name: "Resistor", shortName: "R", defaultValue: "1k", icon_src: "icons/res_eu.svg"};

      onSeries = function(left, right) {
        return left + right;
      }
      onParallel = function(left, right) {
        return (left != 0 && right != 0) ? (1 / (1/left + 1/right)) : 0;
      }
  
      Component.prototype.drawComponent = function() {
        ctx.moveTo(this.x, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width, (this.y + this.height / 2));
      
        ctx.moveTo(this.x + this.width, this.y + this.height / 2);
        ctx.lineTo(this.width*2 + this.x, (this.y + this.height / 2));
        ctx.rect(this.x, this.y, this.width, this.height);
      }
  
      break;
    case "C":
      choosenComponent = {name: "Capacitor", shortName: "C", defaultValue: "1u", icon_src: "icons/capacitor.svg"};
    
      onSeries = function(left, right) {
        return (left != 0 && right != 0) ? (1 / (1/left + 1/right)) : ((left > right) ? left : right);
      } 
      onParallel = function(left, right) {
        return (left != 0 && right != 0) ? (left + right) : 0;
      }
  
      Component.prototype.drawComponent = function() {
        
        ctx.fillRect(this.x + 15, this.y, 3, this.height);
        ctx.fillRect(this.x + this.width - 18, this.y, 3, this.height);
  
        ctx.moveTo(this.x + 15, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width, (this.y + this.height / 2));
      
        ctx.moveTo(this.x + this.width - 15, this.y + this.height / 2);
        ctx.lineTo(this.width * 2 + this.x, (this.y + this.height / 2));
        
      }
  
      break;
    case "L":
      choosenComponent = {name: "Inductor", shortName: "L", defaultValue: "1u", icon_src: "icons/inductor.svg"};

      onSeries = function(left, right) {
        return left + right;
      }
      onParallel = function(left, right) {
        return (left != 0 && right != 0) ? (1 / (1/left + 1/right)) : 0;
      }
      Component.prototype.drawComponent = function() {
    
        
        ctx.arc(this.x + 10, this.y + this.height / 2, 6, -Math.PI,
        0);
    
        ctx.arc(this.x + 20, this.y + this.height / 2, 6, -Math.PI,
        0);
        ctx.arc(this.x + 30, this.y + this.height / 2, 6, -Math.PI,
        0);
    
    
    
        ctx.moveTo(this.x + 4, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width, (this.y + this.height / 2));
          
        ctx.moveTo(this.x + this.width - 4, this.y + this.height / 2);
        ctx.lineTo(this.width * 2 + this.x, (this.y + this.height / 2));
    
      }
      

      break;

    default: break;
  };

}

function modalInit(element) {

  let close = element.querySelector(".close");
  close.addEventListener("click", function() {
    element.style.display = "none";
  });
}

const editValueModalState = {
  component: null
};

function openEditValueModal(component) {
  const editValueModal = document.getElementById("editValueModal");
  const editValueInput = document.getElementById("editValueInput");

  if (!component || !editValueModal || !editValueInput) return;

  editValueModalState.component = component;
  editValueInput.value = component.value.value;
  editValueModal.style.display = "flex";
  editValueInput.focus();
  editValueInput.select();
}

function isAnyModalOpen() {
  const modals = document.querySelectorAll(".modal");
  for (let i = 0; i < modals.length; ++i) {
    if (modals[i].style.display !== "none" && modals[i].style.display !== "") return true;
  }

  return false;
}

function renameExistingComponents(shortName) {
  const renamedComponents = {};
  let componentIndex = 1;

  for (let key in scheme.components) {
    const component = scheme.components[key];
    const newName = shortName + componentIndex.toString();
    component.name.value = newName;
    renamedComponents[newName] = component;
    componentIndex++;
  }

  scheme.components = renamedComponents;
  Component.nameCount = componentIndex;
}

function initModals() {

  let save = document.getElementById("save");
  var saveModal = document.getElementById("saveModal");
  var settingsModal = document.getElementById("settingsModal");
  var solutionModal = document.getElementById("solutionModal");
  var editValueModal = document.getElementById("editValueModal");
  let headerUtility = document.getElementById("headerUtility");
  let expression = document.getElementById("expression");
  let expressionToggle = document.getElementById("expressionToggle");
  let componentOptions = document.querySelectorAll(".settingsComponentOption");
  let editValueForm = document.getElementById("editValueForm");
  let editValueInput = document.getElementById("editValueInput");
  let solutionMethodSelect = document.getElementById("solutionMethodSelect");

  function updateComponentModalState() {
    for (let i = 0; i < componentOptions.length; ++i) {
      let option = componentOptions[i];
      if (option.dataset.component === choosenComponent.shortName) {
        option.classList.add("active");
      } else {
        option.classList.remove("active");
      }
    }
  }

  function syncExpressionToggleFromView() {
    expressionToggle.checked = expression.style.display !== "none";
  }

  function updateExpressionVisibility(isVisible) {
    expression.style.display = isVisible ? "block" : "none";
    resizeSchemeElement();
    resizeCanvas();
    scheme.renderAll();
  }

  modalInit(saveModal);
  modalInit(settingsModal);
  modalInit(solutionModal);
  modalInit(editValueModal);

  const methods = solutionMethodRegistry.list();
  solutionMethodSelect.replaceChildren();
  for (const method of methods) {
    const option = document.createElement("option");
    option.value = method.id;
    option.textContent = method.label;
    solutionMethodSelect.appendChild(option);
  }
  solutionMethodSelect.disabled = methods.length <= 1;
  if (methods.length > 0) {
    document.getElementById("solutionMethodDescription").textContent = methods[0].description;
  }
  solutionMethodSelect.addEventListener("change", function() {
    solveCircuitWithSelectedMethod(false);
  });

  save.addEventListener("click", function() {
    saveModal.style.display="flex";
    document.getElementById("saveText").value = scheme.serialize();
  });

  headerUtility.addEventListener("click", function() {
    updateComponentModalState();
    syncExpressionToggleFromView();
    settingsModal.style.display = "flex";
  });

  for (let i = 0; i < componentOptions.length; ++i) {
    componentOptions[i].addEventListener("click", function() {
      selectComponent(this.dataset.component);
      renameExistingComponents(choosenComponent.shortName);
      updateComponentModalState();
      scheme.renderAll();
    });
  }

  expressionToggle.addEventListener("change", function() {
    updateExpressionVisibility(this.checked);
  });

  let saveBtn = document.getElementById("saveFileBtn");
  saveBtn.addEventListener("click", function() {
    navigator.clipboard.writeText(document.getElementById("saveText").value);
  });

  editValueForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const component = editValueModalState.component;
    if (!component) {
      editValueModal.style.display = "none";
      return;
    }

    scheme.execute(new ChangeComponentValue(component, editValueInput.value));
    editValueModal.style.display = "none";
  });
}

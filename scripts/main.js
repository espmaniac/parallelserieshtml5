const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


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
    let windowDifX = (window.innerWidth - canvas.width) / 2;
    let windowDifY = (window.innerHeight - canvas.height) / 2;
    scheme.offsetX += windowDifX / scheme.zoom;
    scheme.offsetY += windowDifY / scheme.zoom;
  
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    
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

  input.style.height = input.offsetHeight + "px";
  textAreaAutoHeight();
  input.oninput = textAreaAutoHeight;

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
    let ParSer = new ParallelSeries();

    ParSer.onSeries = onSeries;
    ParSer.onParallel = onParallel;
    ParSer.expr = document.getElementById("inp").value;
    
    let solution = ParSer.solve();
    const res = document.getElementById("result");
    res.innerText = "Answer: " + new String(solution);
  };


  scheme.renderAll();
}

function textAreaAutoHeight() {     
  const input = document.getElementById("inp");
    if (parseInt(input.offsetHeight) <= parseInt(input.scrollHeight))
        input.style.height = (input.scrollHeight) + "px"; 
}

function initComponents() {
  let chooseComponent = document.getElementById("chooseComponent");
  let chooseResistor = document.getElementById("resistor");
  let chooseCapactitor = document.getElementById("capacitor");
  let chooseInductor = document.getElementById("inductor");

  chooseResistor.addEventListener("click", function() {
    selectComponent("R");
    chooseComponent.remove();
  });

  chooseCapactitor.addEventListener("click", function() {
    selectComponent("C");
    chooseComponent.remove();

  });
  
  chooseInductor.addEventListener("click", function() {
    selectComponent("L");
    chooseComponent.remove();
  });

  let open = document.getElementById("open");
  open.addEventListener("click", function() {
    scheme.deserialize(document.getElementById("openScheme").value);
    chooseComponent.remove();
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

function initModals() {

  let save = document.getElementById("save");
  var saveModal = document.getElementById("saveModal");
  modalInit(saveModal);
  save.addEventListener("click", function() {    
    saveModal.style.display="block";
    document.getElementById("saveText").value = scheme.serialize();
  });
  let saveBtn = document.getElementById("saveFileBtn");
  saveBtn.addEventListener("click", function() {
    navigator.clipboard.writeText(document.getElementById("saveText").value);
  });
}
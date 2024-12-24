const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


var choosenComponent = {name: "", shortName: "", defaultValue: ""};

var count = 1; // component index

var cursor =  {
  touches: null,
  offsetX: 0,
  offsetY: 0,
  lastTouch: null
};


window.onload = function() {
  scheme.renderAll();
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

  context_menu.element = document.getElementById("contextMenu");
  context_menu.main_menu.element = document.getElementById("ctxUL");

  context_menu.element.addEventListener("click", function(event) {
    let target = event.target;
    
    if (target.children.length <= 0) {
      context_menu.hide();
    }
  
  });

  canvas.addEventListener("contextmenu", toolmgr.onContextMenu);
  

  input.style.height = input.offsetHeight + "px";
  textAreaAutoHeight();
  input.oninput = textAreaAutoHeight;

  initComponents();

  initTools();

  var btnAdd = document.getElementById("addComponent");
  btnAdd.addEventListener("click", function() {
    let countStr = count.toString();
    scheme.components[choosenComponent.shortName + countStr] = (
      new Component(choosenComponent.shortName + countStr, choosenComponent.defaultValue, 
        snapToGrid(scheme.screenToWorldSpace(canvas.width / 2,0).x), 
        snapToGrid(scheme.screenToWorldSpace(0,canvas.height / 2).y)
      )
    );
    count += 1;
    scheme.renderAll();
  });

  
  var btnClear = document.getElementById("clear");
  btnClear.addEventListener("click", function() {
    let del = confirm("Do you want to clear the circuit?");
    if (del) {
      count = 1;
      scheme.clear();
    }
    scheme.renderAll();
  });

}


function initComponents() {
  let chooseComponent = document.getElementById("chooseComponent");
  let chooseResistor = document.getElementById("resistor");
  let chooseCapactitor = document.getElementById("capacitor");
  let chooseInductor = document.getElementById("inductor");
  let addComponentIcon = document.getElementById("addComponent").children[0];

  chooseResistor.addEventListener("click", function() {
    choosenComponent = {name: "Resistor", shortName: "R", defaultValue: "1k"};
    addComponentIcon.src = "icons/res_eu.svg";
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

    chooseComponent.remove();
  });

  chooseCapactitor.addEventListener("click", function() {
    choosenComponent = {name: "Capacitor", shortName: "C", defaultValue: "1u"};
    addComponentIcon.src = "icons/capacitor.svg";
    
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

    chooseComponent.remove();

  });
  
chooseInductor.addEventListener("click", function() {
  choosenComponent = {name: "Inductor", shortName: "L", defaultValue: "1u"};
  addComponentIcon.src = "icons/inductor.svg";
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
  chooseComponent.remove();
  });
}

function initTools() {
  let mainTools = document.getElementById("mainTools");
  let nodeTools = document.getElementById("nodeTools");
  let cursorTool = document.getElementById("cursorTool");
  let wireTool = document.getElementById("wireTool");

  function removeActive() {
    for (let i = 0; i < mainTools.children.length; ++i) {
      mainTools.children[i].classList.remove("active");
    }
    for (let i = 0; i < nodeTools.children.length; ++i) {
      nodeTools.children[i].classList.remove("active");
    }
  }

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
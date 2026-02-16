var toolmgr = {
    activeCmd: null,

    onMouseDown(event) {
      const mouseX = event.clientX - canvas.getBoundingClientRect().left;
      const mouseY = event.clientY - canvas.getBoundingClientRect().top;

      context_menu.hide();
    
      if (event.button === 0) { // left btn
    
        if (scheme.tool === "SELECT") {
          scheme.trySelectComponent(mouseX, mouseY);
          scheme.trySelectWires(mouseX, mouseY);
          scheme.trySelectLabel(mouseX, mouseY);
        }
        if (scheme.tool === "WIRE" && scheme.selectedComponents.length <= 0 && !scheme.isDragging) {
            let wire = new Wire();
            let draw = toolmgr.activeCmd = new DrawWire(wire);
            draw.from(mouseX, mouseY);
    
            scheme.wires.push(wire);
            scheme.isDragging = true;
        }
    
      } 
      if (event.button === 1) { // wheel button
        scheme.isPanning = true;
        scheme.panOffX = mouseX;
        scheme.panOffY = mouseY;
        event.preventDefault();
      }



      scheme.renderAll();
    },

    onMouseMove(event) {
        let mouseX = event.clientX - canvas.getBoundingClientRect().left;
        let mouseY = event.clientY - canvas.getBoundingClientRect().top;
        let cmd = toolmgr.activeCmd;

        if (scheme.isPanning) {
            scheme.Pan(mouseX, mouseY);
        }

        else if (cmd)
            switch(cmd.name) {
                case "DragComponent":
                    cmd.move(mouseX, mouseY, true);
                    break;

                case "DrawWire":
                    cmd.to(mouseX, mouseY);
                    break;

                default: break;
            }

        scheme.panOffX = mouseX;
        scheme.panOffY = mouseY;

        scheme.renderAll();
    },

    onMouseUp(event) {
        let mouseX = event.clientX - canvas.getBoundingClientRect().left;
        let mouseY = event.clientY - canvas.getBoundingClientRect().top;
        let cmd = toolmgr.activeCmd;

        if (event.button === 0 && cmd) {

            switch(cmd.name) {
                case "DragComponent":
                    cmd.move(mouseX, mouseY, false);
                    if (cmd.posX === cmd.oldPosX && cmd.posY === cmd.oldPosY) {
                        cmd.execute();
                        cmd = null;
                    }
                    
                    break;
                case "DrawWire":
                    cmd.to(mouseX, mouseY);
                    let w = cmd.wire;
                    if (w.nodes[0].x === w.nodes[1].x && w.nodes[0].y === w.nodes[1].y) {
                        scheme.wires.pop();
                        cmd = null;
                    }
                    break;

                default: break;
            }
            scheme.isDragging = false;
            scheme.execute(cmd);

            toolmgr.activeCmd = null;
        }

        if (event.button === 1 && scheme.isPanning) {
            scheme.isPanning = false;
        }

    },

    onMouseWheel(event) { // zoom
        event.preventDefault();

        let mouseX = event.clientX - canvas.getBoundingClientRect().left;
        let mouseY = event.clientY - canvas.getBoundingClientRect().top;

        
        const delta = Math.sign(event.deltaY);
        let zoom = scheme.zoom;
        zoom -= delta * 0.25;

        scheme.Zoom(zoom, mouseX, mouseY);
    },

    onTouchStart(event) {
        event.preventDefault();

        context_menu.hide();

        let distance = 0;

        if (cursor.touches) {
            let currentTouch = event.touches[0];
            let prevTouch = cursor.touches[0];
            distance = Math.sqrt(Math.pow(currentTouch.clientX - prevTouch.clientX,2) + Math.pow(currentTouch.clientY - prevTouch.clientY,2));
        }

        cursor.touches = event.touches;

        let pointerX = event.touches[0].clientX - canvas.getBoundingClientRect().left;
        let pointerY = event.touches[0].clientY - canvas.getBoundingClientRect().top;

        let touchTime = new Date().getTime();
        

        if (scheme.tool === "SELECT") {

            scheme.trySelectComponent(pointerX, pointerY);
            scheme.trySelectWires(pointerX, pointerY);
            scheme.trySelectLabel(pointerX, pointerY);

            if (!scheme.selectedComponents.length && !scheme.selectedWires.length) {
                scheme.isPanning = true;
            }

        }

        if (
            cursor.lastTouches &&
            (event.touches.length < 2) && 
            distance < 30 &&
            ((touchTime - cursor.lastTouches["0"]) < 300)
        ) { // double tap
            let touch = event.touches[0];
            canvas.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: touch.clientX,
                clientY: touch.clientY
            }));
        }
        

        scheme.panOffX = pointerX;
        scheme.panOffY = pointerY;

        if (scheme.tool === "WIRE" && scheme.selectedComponents.length <= 0 && !scheme.isDragging) {
            let wire = new Wire();
            let draw = toolmgr.activeCmd = new DrawWire(wire);
            draw.from(pointerX, pointerY);
    
            scheme.wires.push(wire);
            scheme.isDragging = true;
        }

        let timeTouches = {};

        for (let i = 0; i < event.touches.length; ++i) {
            timeTouches[event.touches[i].identifier] = touchTime;
        }
        cursor.lastTouches = timeTouches;

    },

    onTouchMove(event) {

        event.preventDefault();

        let pointerX = event.touches[0].clientX - canvas.getBoundingClientRect().left;
        let pointerY = event.touches[0].clientY - canvas.getBoundingClientRect().top;
        let cmd = toolmgr.activeCmd;

        if (cursor.touches.length !== event.touches.length) {
            scheme.panOffX = pointerX;
            scheme.panOffY = pointerY;

        }

        if (event.touches.length > 1) { /*<zoom>*/ 
        
            let calcDistance = function(x1,y1, x2, y2) {
                return Math.sqrt(
                    Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)
                );
            }


            let distancePreviousTouches = calcDistance(cursor.touches[0].clientX, cursor.touches[0].clientY, 
                cursor.touches[1].clientX, cursor.touches[1].clientY);
            let distanceCurrentTouches = calcDistance(event.touches[0].clientX, event.touches[0].clientY, 
                event.touches[1].clientX, event.touches[1].clientY);


            let midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            let midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;


            let zoom = scheme.zoom;

            zoom *= (distanceCurrentTouches / distancePreviousTouches);

            scheme.Zoom(zoom, midX, midY);
                
        } /*</zoom>*/ 

        if (cmd)
            switch(cmd.name) {
                case "DragComponent":
                    cmd.move(pointerX, pointerY, true);
                    break;

                case "DrawWire":
                    cmd.to(pointerX, pointerY);
                    break;

                default: break;
            }


        if (scheme.isPanning && !cmd && event.touches.length <= 1) {
            scheme.Pan(pointerX, pointerY);
        }

        scheme.panOffX = pointerX;
        scheme.panOffY = pointerY;

        cursor.touches = event.touches;

        scheme.renderAll();
    },

    onTouchEnd(event) {
        event.preventDefault();
        let pointerX = event.changedTouches[0].clientX - canvas.getBoundingClientRect().left;
        let pointerY = event.changedTouches[0].clientY - canvas.getBoundingClientRect().top;

        // don't stop panning, dragging, drawing if there are fingers on the screen
        if (cursor.touches.length !== event.changedTouches.length) return;

        let cmd = toolmgr.activeCmd;


        if (cmd) {
            switch(cmd.name) {
                case "DragComponent":
                    cmd.move(pointerX, pointerY, false);
                    if (cmd.posX === cmd.oldPosX && cmd.posY === cmd.oldPosY) {
                        cmd.execute();
                        cmd = null;
                    }
                    
                    break;
                case "DrawWire":
                    cmd.to(pointerX, pointerY);
                    let w = cmd.wire;
                    if (w.nodes[0].x === w.nodes[1].x && w.nodes[0].y === w.nodes[1].y) {
                        scheme.wires.pop();
                        cmd = null;
                    }
                    break;

                default: break;
            }
            scheme.isDragging = false;
            scheme.execute(cmd);

            toolmgr.activeCmd = null;
        }
        
        if (scheme.isPanning) {
            scheme.isPanning = false;
        }

    },

    onContextMenu(event) {
        event.preventDefault();

        const canvasRect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - canvasRect.left;
        const canvasY = event.clientY - canvasRect.top;

        context_menu.clear();

        context_menu.setPos(event.clientX, event.clientY);

        let startNodeMenu = new Menu("StartNode = ");
        let destNodeMenu = new Menu("DestNode = ");

        let addNodesSubMenu = function(nodes) {
            for (let i = 0; i < nodes.length; ++i) {
                let node = nodes[i];
                startNodeMenu.addItem(new Item("N" + i, function() { scheme.execute(new SetLabelNode(scheme.labels[0], node)); }));
                destNodeMenu.addItem(new Item("N" + i, function() { scheme.execute(new SetLabelNode(scheme.labels[1], node)); }));
            }
        }
                
        if (scheme.selectedComponents.length) {
            var component = scheme.selectedComponents[0];

            addNodesSubMenu(component.nodes);

            context_menu.main_menu.addItem(startNodeMenu);
            context_menu.main_menu.addItem(destNodeMenu);

            context_menu.main_menu.addItem(new Item("Edit Value", function() {
                let newValue = prompt(`new ${component.name.value} value`);
                scheme.execute(new ChangeComponentValue(component, newValue));
            }));

            context_menu.main_menu.addItem(new Item("Rotate -45", function() {
                scheme.execute(new RotateComponent(component, -45));
            }));

            context_menu.main_menu.addItem(new Item("Rotate +45", function() {
                scheme.execute(new RotateComponent(component, +45));
            }));

            context_menu.main_menu.addItem(new Item("Delete", function() {
                scheme.execute(new DeleteElement(component));
            }));

        }

        else if (scheme.selectedWires.length) {
            var wire = scheme.wires[scheme.selectedWires[0]];

            addNodesSubMenu(wire.nodes);
            context_menu.main_menu.addItem(startNodeMenu);
            context_menu.main_menu.addItem(destNodeMenu);

            context_menu.main_menu.addItem(new Item("Delete", function() {
                scheme.execute(new DeleteElement(wire));
            }));

        }

        else {

            
            let selectedLabel = scheme.labels.find(function(l) { return l.selected === true; });

            if (selectedLabel) {
                context_menu.main_menu.addItem(new Item(`Rotate +45`, function() {
                    scheme.execute(new RotateComponent(selectedLabel, +45));
                }));
                context_menu.main_menu.addItem(new Item(`Rotate -45`, function() {
                    scheme.execute(new RotateComponent(selectedLabel, -45));
                }));
                context_menu.main_menu.addItem(new Item(`Delete`, function() {
                    scheme.execute(new DeleteElement(selectedLabel));
                }));
            }

            else {
                context_menu.main_menu.addItem(
                    new Item(`<p>Add</p> <img src='${choosenComponent.icon_src}' width="40" height="14"></img>`, 
                    function() {
                        scheme.execute(new AddComponent(canvasX, canvasY));
                    }
                ));

                context_menu.main_menu.addItem(new Item(`Undo`, () => scheme.undo()));

                context_menu.main_menu.addItem(new Item(`Redo`, () => scheme.redo()));
            }
        }

        context_menu.show();
        scheme.renderAll();
    },

    onKeyDown(event) {
        switch(event.keyCode) {
            case 8: case 46:
                let elm = (scheme.selectedComponents.length) 
                    ? scheme.selectedComponents[0] : 
                    (scheme.selectedWires.length) ? scheme.wires[scheme.selectedWires[0]] : 
                    scheme.labels.find(function(l) { return l.selected === true; });

                if (elm) scheme.execute(new DeleteElement(elm));

                break;

            case 82:
                if (scheme.selectedComponents.length > 0) {
                    let component = scheme.selectedComponents[0];
                    if (event.ctrlKey) {
                        event.preventDefault();
                        scheme.execute(new RotateComponent(component, -45));
                    } else {
                        scheme.execute(new RotateComponent(component, 45));
                    }
                }
                break;

            case 83:
                removeActive();
                let cursorTool = document.getElementById("cursorTool");
                cursorTool.classList.add("active");
                scheme.tool = "SELECT";
                
                break;

            case 87:
                removeActive();
                let wireTool = document.getElementById("wireTool");
                wireTool.classList.add("active");
                scheme.tool = "WIRE";
                break;

            case 90:
                if (event.ctrlKey) {
                    if (event.shiftKey) {
                        event.preventDefault();
                        scheme.redo();
                    } else {
                        event.preventDefault();
                        scheme.undo();
                    }
                }
                break;
            default: break;
        }

    }

};   
  


var toolmgr = {

    onMouseDown(event) {
      const mouseX = event.clientX - canvas.getBoundingClientRect().left;
      const mouseY = event.clientY - canvas.getBoundingClientRect().top;
    
      menu.style.display = "none";
    
      if (event.button === 0) { // left btn
    
        if (scheme.tool === "SELECT") {
          scheme.trySelectComponent(mouseX, mouseY);
          scheme.trySelectWires(mouseX, mouseY);
        }
    
        scheme.tryDrawWireFrom(mouseX, mouseY);
    
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
        
        if (scheme.isPanning) {
            scheme.Pan(mouseX, mouseY);
        }

        else if (scheme.isDragging) {
            if (scheme.selectedComponents.length > 0) {
                scheme.dragComponent(mouseX, mouseY, true);
            } else {
                scheme.tryDrawWireTo(mouseX, mouseY, false);
            }
        }

        scheme.panOffX = mouseX;
        scheme.panOffY = mouseY;

        scheme.renderAll();
    },

    onMouseUp(event) {
        let mouseX = event.clientX - canvas.getBoundingClientRect().left;
        let mouseY = event.clientY - canvas.getBoundingClientRect().top;

        if (event.button === 0 && scheme.isDragging) {
            if (scheme.selectedComponents.length > 0) {
                scheme.dragComponent(mouseX, mouseY, false);

            } 
            else {
                scheme.tryDrawWireTo(mouseX, mouseY, true);
            }
            scheme.isDragging = false;
        }

        if (event.button === 1 && scheme.isPanning) {
            scheme.isPanning = false;
        }

        scheme.renderAll();
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


        cursor.touches = event.touches;

        let pointerX = event.touches[0].clientX - canvas.getBoundingClientRect().left;
        let pointerY = event.touches[0].clientY - canvas.getBoundingClientRect().top;

        if (scheme.tool === "SELECT") {

            scheme.trySelectComponent(pointerX, pointerY);
            scheme.trySelectWires(pointerX, pointerY);

            if (!scheme.selectedComponents.length && !scheme.selectedWires.length) {
                scheme.isPanning = true;
            }

        }

        scheme.panOffX = pointerX;
        scheme.panOffY = pointerY;

        scheme.tryDrawWireFrom(pointerX, pointerY);
    },

    onTouchMove(event) {

        event.preventDefault();

        let pointerX = event.touches[0].clientX - canvas.getBoundingClientRect().left;
        let pointerY = event.touches[0].clientY - canvas.getBoundingClientRect().top;

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


        if (scheme.isPanning  && event.touches.length <= 1) {
            scheme.Pan(pointerX, pointerY);
        }

        else if (scheme.isDragging) {
            if (scheme.selectedComponents.length > 0) {
                scheme.dragComponent(pointerX, pointerY, true);
            }
            else {
                scheme.tryDrawWireTo(pointerX, pointerY, false);
            }
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


        if (scheme.isDragging) {
            if (scheme.selectedComponents.length > 0) {
                scheme.dragComponent(pointerX, pointerY, false);
            } 
            else {
                scheme.tryDrawWireTo(pointerX, pointerY, true);
            }

            scheme.isDragging = false;
        }
        if (scheme.isPanning) {
            scheme.isPanning = false;
        }

        scheme.renderAll();
    }

};   
  



/*

document.addEventListener('keypress', function(e) { // rotate
  if (e.key === 'r' && selectedComponents.length > 0) {

    selectedComponents[0].rotate(45);

    if (!isDragging) {
      selectedComponents[0].update();
      updateComponentConnections(selectedComponents[0]);
    }
 
    renderAll();
  } 

  if (e.key === 'e' && selectedComponents.length > 0) {
    let newValue = prompt(`new ${selectedComponents[0].name} value`);
    selectedComponents[0].value.value = newValue;

    renderAll();
  }
});

*/

document.addEventListener("keyup", function(e) { // delete
    if (((e.keyCode === 46) || (e.keyCode === 8)) && scheme.isMouseHover) {
  
      scheme.deleteSelected();
  
    }
});

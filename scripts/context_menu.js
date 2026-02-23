class Menu {
    constructor(text) {
        this.className = "Menu";
        this.element = document.createElement("ul");
        this.items = [];
        this.submenus = [];
        this.parent = null;
        this.level = 0;
        this.text = text;
    }

    addItem(item) {
        if (!item) return; 

        item.parent = this;

        if(item.className === "Item") {
            this.items.push(item);

            this.element.appendChild(item.element);
        }
        else if (item.className === "Menu") {
            
            item.level = this.level + 1;

            item.update();

            let li = document.createElement("li");
            li.classList.add("hasSubMenu");
            li.innerHTML = item.text;
            li.appendChild(item.element);

            this.element.appendChild(li);

            this.submenus.push(item);
        }

    }

    update() {
        this.element.className = "";

        if (this.level === 1) {
            this.element.classList.add("dropDownMenu");
        }
        else if (this.level > 1) {
            this.element.classList.add("subDropDownMenu");
        }
        for (let i = 0; i < this.submenus.length; ++i) {
            let m = this.submenus[i];
            m.level = this.level + 1;

            m.update();
        }
    }

    onDelete() {
        for (let i = 0; i < this.items.length; ++i) {
            let item = this.items[i];
            item.onDelete();
        }
        for (let i = 0; i < this.submenus.length; ++i) {
            let submenu = this.submenus[i];
            submenu.onDelete();
        }
        this.items = [];
        this.submenus = [];
        this.element.innerHTML = "";
    }
}

class Item {
    constructor(txt, cmd) {
        this.className = "Item";
        this.parent = null;
        this.element = document.createElement('li');
        this.element.innerHTML = txt;
        this.clickFN = function(e) {
            cmd();
            context_menu.hide();
        };
        this.element.addEventListener("click", this.clickFN);
    }

    onDelete() {
        this.element.removeEventListener("click", this.clickFN);
    }
}



var context_menu = {
    element: null,
    main_menu: new Menu(""),

    setPos(x, y) {

        this.element.style.left = x + "px";
        this.element.style.top = y + "px";
        this.element.style.right = "auto";

        if (x < (getCanvasWidth() / 2)) {
            this.element.style.setProperty('--subMenuOffsetLeft', "100%");
            this.element.style.setProperty('--subMenuOffsetRight', "auto");
            this.element.dataset.submenuDirection = "right";
        }
        else {
            this.element.style.setProperty('--subMenuOffsetLeft', "auto");
            this.element.style.setProperty('--subMenuOffsetRight', "100%");
            this.element.dataset.submenuDirection = "left";
        }
        
    },

    show() {
        this.element.style.display = "block";
    },

    hide() {
        this.element.style.display = "none";
    },

    hidden() {
        return (this.element.style.display === "none") ? true : false;
    },

    clear() {
        this.main_menu.onDelete();
    }

};


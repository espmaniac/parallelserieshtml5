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
            li.innerText = item.text;
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

    getRight() {
        let right = this.element.getBoundingClientRect().right;

        for (let i = 0; i < this.submenus.length; ++i) {
            let m = this.submenus[i];
            let res = m.getRight();
            if (res) {
                right = res;
                break;
            }
        }
        return right;
    }

    getBottom() {
        let bottom = this.element.getBoundingClientRect().bottom;

        for (let i = 0; i < this.submenus.length; ++i) {
            let m = this.submenus[i];
            let res = m.getBottom();
            if (res) {
                bottom = res;
                break;
            }
        }
        return bottom;
    }

}

class Item {
    constructor(txt, cmd) {
        this.className = "Item";
        this.parent = null;
        this.cmd = cmd;
        this.element = document.createElement('li');
        this.element.innerText = txt;
        this.element.addEventListener("click", cmd);
    }

    onDelete() {
        this.element.removeEventListener("click", this.cmd);
    }
}



var context_menu = {
    element: null,
    main_menu: new Menu(""),

    setPos(x, y) {
        this.element.style.left = x + "px";
        this.element.style.top = y + "px";
    },

    show() {
        this.element.style.display = "block";
        this.noIntersect();
    },

    hide() {
        this.element.style.display = "none";
    },

    hidden() {
        return (this.element.style.display === "none") ? true : false;
    },

    clear() {
        this.main_menu.onDelete();
    },

    noIntersect() {

        let thisLeft = this.element.getBoundingClientRect().left;
        let thisTop = this.element.getBoundingClientRect().top;

        let right = this.main_menu.getRight();
        let bottom = this.main_menu.getBottom();
        if (right > canvas.width) {
            let left = thisLeft;
            left -= right - canvas.width;
            this.element.style.left = left + "px";
        }
        if (bottom > canvas.height) {
            let top = thisTop;
            top -= bottom - canvas.height;
            this.element.style.top = top + "px";
        }

        if (thisLeft < canvas.getBoundingClientRect().left)
             this.element.style.left = "0px";

        if (thisTop < canvas.getBoundingClientRect().top)
            this.element.style.top = "0px";


    }
};


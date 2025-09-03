<div align="center">
  <img src="https://github.com/espmaniac/parallelserieshtml5/blob/main/logo/favicon.svg" alt="logo" width="200" height="200"/>
</div>

# <p align="center">ParallelSeriesHTML5</p>

**📐 Visual Circuit Editor and Calculator for Resistors, Capacitors, and Inductors**

## 🔧 Overview

**ParallelSeriesHTML5** is a **web-based circuit editor and calculator**. It allows users to **draw circuits**, **organize components in series or parallel**, and **calculate equivalent values** in real time. Circuits can be **saved and loaded in JSON format**, making this tool perfect for electronics enthusiasts, students, and engineers who want to design and analyze circuits visually and interactively.

---

## 🚀 Features

- **Interactive Circuit Editing**
  - Add, move, rotate, or delete **components** (wires are drawn but **cannot be moved freely**).  
  - Real-time visual feedback while drawing or dragging elements.
- **Component Support**
  - Resistors, capacitors, and inductors.
- **Series & Parallel Calculations**
  - Instantly compute equivalent values for selected sections of your circuit.  
  - **Important:** To perform calculations, specify **StartNode** and **DestNode** using the **context menu** on components or wires.
- **JSON Storage**
  - Save and load circuits for future editing or sharing.
- **Undo / Redo**
  - Flexible editing workflow.
- **Mouse & Touch Support**
  - Left-click / tap → select components or draw wires  
  - Middle-click / two-finger drag → pan  
  - Scroll wheel / pinch → zoom
- **Keyboard Shortcuts**
  - `S` → select tool  
  - `W` → wire tool  
  - `Delete` / `Backspace` → remove selected elements  
  - `Ctrl+Z` → undo  
  - `Ctrl+Shift+Z` → redo
- **Context Menu Controls**
  - Assign **StartNode** and **DestNode** for calculations  
  - Edit component values, rotate, delete, or assign nodes for wires and labels

> **Note:**  
> - Wires cannot be moved after being drawn.  
> - Delta (Δ) to Wye (Y) transformations are **not currently implemented**.

---

## 🖱️ & ⌨️ Controls Overview

| Action | Input |
|--------|-------|
| Select / move components | Left-click or tap |
| Draw wires | Left-click on empty space / tap |
| Pan view | Middle-click drag / two-finger drag |
| Zoom | Scroll wheel / pinch |
| Delete element | `Delete` / `Backspace` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Switch tools | `S` → select, `W` → wire |
| Specify StartNode / DestNode | Right-click (context menu) on component or wire |

---

## 🎨 Example Screenshots

![Circuit Editor Screenshot](https://github.com/espmaniac/parallelserieshtml5/blob/main/examples/ex1/scrn.png)  
*Draw your circuit visually and see series/parallel equivalents instantly.*

*Save or load circuits in JSON format for easy sharing.*
```
{
  "component": "R",
  "ComponentNameCount": 12,
  "zoom": 1.25,
  "offsetX": -1140,
  "offsetY": -535,
  "components": {
    "R1": {
      "x": 1340,
      "y": 970,
      "value": "1k",
      "angle": 0
    },
    "R2": {
      "x": 1490,
      "y": 930,
      "value": "1k",
      "angle": -45
    },
    "R3": {
      "x": 1490,
      "y": 1010,
      "value": "1k",
      "angle": 45
    },
    "R4": {
      "x": 1570,
      "y": 930,
      "value": "1k",
      "angle": 45
    },
    "R5": {
      "x": 1570,
      "y": 1010,
      "value": "1k",
      "angle": -45
    },
    "R6": {
      "x": 1820,
      "y": 920,
      "value": "1k",
      "angle": 0
    },
    "R7": {
      "x": 1820,
      "y": 1020,
      "value": "1k",
      "angle": 0
    },
    "R8": {
      "x": 1940,
      "y": 890,
      "value": "1k",
      "angle": 0
    },
    "R9": {
      "x": 1940,
      "y": 1050,
      "value": "1k",
      "angle": 0
    },
    "R10": {
      "x": 1940,
      "y": 990,
      "value": "1k",
      "angle": 0
    },
    "R11": {
      "x": 1940,
      "y": 950,
      "value": "1k",
      "angle": 0
    }
  },
  "wires": [
    {
      "x1": 1420,
      "y1": 980,
      "x2": 1470,
      "y2": 980
    },
    {
      "x1": 1630,
      "y1": 980,
      "x2": 1730,
      "y2": 980
    },
    {
      "x1": 1730,
      "y1": 980,
      "x2": 1780,
      "y2": 1030
    },
    {
      "x1": 1730,
      "y1": 980,
      "x2": 1780,
      "y2": 930
    },
    {
      "x1": 1900,
      "y1": 900,
      "x2": 1900,
      "y2": 930
    },
    {
      "x1": 1900,
      "y1": 960,
      "x2": 1900,
      "y2": 930
    },
    {
      "x1": 1900,
      "y1": 1000,
      "x2": 1900,
      "y2": 1030
    },
    {
      "x1": 1900,
      "y1": 1060,
      "x2": 1900,
      "y2": 1030
    },
    {
      "x1": 2020,
      "y1": 900,
      "x2": 2020,
      "y2": 930
    },
    {
      "x1": 2020,
      "y1": 930,
      "x2": 2140,
      "y2": 930
    },
    {
      "x1": 2020,
      "y1": 960,
      "x2": 2020,
      "y2": 930
    },
    {
      "x1": 2020,
      "y1": 1000,
      "x2": 2020,
      "y2": 1030
    },
    {
      "x1": 2020,
      "y1": 1030,
      "x2": 2140,
      "y2": 1030
    },
    {
      "x1": 2020,
      "y1": 1060,
      "x2": 2020,
      "y2": 1030
    },
    {
      "x1": 2140,
      "y1": 1030,
      "x2": 2140,
      "y2": 980
    },
    {
      "x1": 2140,
      "y1": 980,
      "x2": 2310,
      "y2": 980
    },
    {
      "x1": 2140,
      "y1": 930,
      "x2": 2140,
      "y2": 980
    }
  ],
  "labels": [
    {
      "text": "StartNode",
      "angle": 0,
      "nodeX": 1300,
      "nodeY": 980,
      "nodeParent": {
        "type": "Component",
        "value": "R1"
      },
      "offX": 0,
      "offY": -15,
      "radius": 5
    },
    {
      "text": "DestNode",
      "angle": 0,
      "nodeX": 2310,
      "nodeY": 980,
      "nodeParent": {
        "type": "Wire",
        "value": 15
      },
      "offX": 0,
      "offY": -15,
      "radius": 5
    }
  ]
}
```
---

## 🔗 Live Demo

Try it in your browser: [ParallelSeriesHTML5](https://espmaniac.github.io/parallelserieshtml5/)


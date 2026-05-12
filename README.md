# Circle Fit AI Drawing App

An interactive drawing application that uses real-time least-squares geometry to dynamically fit the optimal circle to your freehand strokes.

The application exists in two formats: a **Web Version** (Vanilla HTML/CSS/JS) and a **Desktop Version** (Python/Pygame).

🌐 **[Try the Live Web App Here!](https://sameeptandon.github.io/circle_fit/)**

## Features

- **Real-Time Fitting:** As you draw, the application continuously calculates and overlays the mathematically optimal circle for your strokes.
- **Intersection Percentage:** Dynamically displays what percentage of your drawn pixels cleanly intersect with the calculated best-fit circle.
- **Mobile Responsive:** The web application natively supports touch events and scales gracefully on iOS and Android devices.
- **Toggle View:** Hide or show the best-fit circle while you draw to test your raw accuracy.

---

## 1. Web Version (Recommended)

The web version is a high-performance, dependency-free port of the application. It uses pure JavaScript to solve the $3 \times 3$ matrix inversion equations natively in the browser without any heavy math libraries.

### How to Run Locally
Because the web app uses vanilla HTML, CSS, and JS, you can run it using any simple local server.
1. Navigate to the `web` folder:
   ```bash
   cd web
   ```
2. Start a basic Python HTTP server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in your web browser.

---

## 2. Python Desktop Version (Pygame)

The original desktop application uses Python, `pygame` for the GUI, and `numpy` for the matrix mathematics. 

### How to Run Locally
1. Ensure you have Python 3 installed.
2. Install the required dependencies:
   ```bash
   pip install pygame numpy
   ```
3. Run the application from the root folder:
   ```bash
   python draw_app.py
   ```

## The Math Behind It

The application mathematically determines the center coordinates $(x_c, y_c)$ and radius $R$ of the best-fit circle by solving the least-squares problem:
$$ (x - x_c)^2 + (y - y_c)^2 = R^2 $$

This is expanded into a linear system $Ac = b$, and the $3 \times 3$ matrix is inverted in real time to guarantee a sub-millisecond response delay even with thousands of pixels drawn.

# Shape Fit AI Drawing App

An interactive drawing application that uses real-time geometry to dynamically fit the selected shape to your freehand strokes.

The application exists in two formats: a **Web Version** (Vanilla HTML/CSS/JS) and a **Desktop Version** (Python/Pygame).

🌐 **[Try the Live Web App Here!](https://sameeptandon.github.io/circle_fit/)**

## Features

- **Real-Time Fitting:** As you draw, the application continuously calculates and overlays the selected best-fit shape for your strokes.
- **Circle and Triangle Modes:** Fit either a least-squares circle or an equilateral triangle to your drawing.
- **Intersection Percentage:** Dynamically displays what percentage of your drawn pixels cleanly intersect with the calculated best-fit shape.
- **Mobile Responsive:** The web application natively supports touch events and scales gracefully on iOS and Android devices.
- **Toggle View:** Hide or show the best-fit shape while you draw to test your raw accuracy.

---

## 1. Web Version (Recommended)

The web version is a high-performance, dependency-free port of the application. It uses pure JavaScript to solve the circle equations and triangle geometry natively in the browser without any heavy math libraries.

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

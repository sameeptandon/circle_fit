import pygame
import sys
import numpy as np

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
PANEL_HEIGHT = 50
FPS = 120

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
DARK_GRAY = (150, 150, 150)
RED = (255, 0, 0)

# Set up the display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Drawing App")

# Font for buttons
font = pygame.font.SysFont(None, 30)

class Button:
    def __init__(self, x, y, w, h, text, action_mode):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text
        self.action_mode = action_mode
        
    def draw(self, surface, current_mode):
        # Highlight button if it is the current mode
        color = DARK_GRAY if current_mode == self.action_mode else WHITE
        pygame.draw.rect(surface, color, self.rect)
        pygame.draw.rect(surface, BLACK, self.rect, 2)
        
        text_surf = font.render(self.text, True, BLACK)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)


def distance_to_segment(points, a, b):
    segment = b - a
    segment_len_sq = np.dot(segment, segment)
    if segment_len_sq == 0:
        return np.linalg.norm(points - a, axis=1)

    t = np.clip(((points - a) @ segment) / segment_len_sq, 0, 1)
    projections = a + t[:, None] * segment
    return np.linalg.norm(points - projections, axis=1)


def sample_points(points, max_points=1200):
    if len(points) <= max_points:
        return points.astype(float)

    step = int(np.ceil(len(points) / max_points))
    return points[::step].astype(float)


def equilateral_vertices(params):
    cx, cy, radius, theta = params
    radius = max(1, radius)
    angles = theta + np.arange(3) * (2 * np.pi / 3)
    return np.column_stack([cx + radius * np.cos(angles), cy + radius * np.sin(angles)])


def equilateral_loss(params, points):
    triangle = equilateral_vertices(params)
    distances = []
    for i in range(3):
        distances.append(distance_to_segment(points, triangle[i], triangle[(i + 1) % 3]))
    min_distances = np.min(np.column_stack(distances), axis=1)
    return np.mean(min_distances**2)


def initial_equilateral_params(points):
    center = np.mean(points, axis=0)
    radius = max(1, np.max(np.linalg.norm(points - center, axis=1)))

    best_params = np.array([center[0], center[1], radius, 0.0], dtype=float)
    best_loss = float("inf")
    for theta in np.linspace(0, 2 * np.pi / 3, 24, endpoint=False):
        params = np.array([center[0], center[1], radius, theta], dtype=float)
        loss = equilateral_loss(params, points)
        if loss < best_loss:
            best_loss = loss
            best_params = params

    return best_params


def fit_triangle(points):
    fit_points = sample_points(points)
    if len(fit_points) < 4:
        return None

    start = initial_equilateral_params(fit_points)
    simplex = np.array([
        start,
        start + np.array([12, 0, 0, 0]),
        start + np.array([0, 12, 0, 0]),
        start + np.array([0, 0, start[2] * 0.08 + 1, 0]),
        start + np.array([0, 0, 0, np.pi / 36]),
    ], dtype=float)
    values = np.array([equilateral_loss(params, fit_points) for params in simplex])

    for _ in range(45):
        order = np.argsort(values)
        simplex = simplex[order]
        values = values[order]

        centroid = np.mean(simplex[:-1], axis=0)
        worst = simplex[-1]
        reflected = centroid + (centroid - worst)
        reflected[2] = max(1, reflected[2])
        reflected_value = equilateral_loss(reflected, fit_points)

        if reflected_value < values[0]:
            expanded = centroid + 2 * (reflected - centroid)
            expanded[2] = max(1, expanded[2])
            expanded_value = equilateral_loss(expanded, fit_points)
            if expanded_value < reflected_value:
                simplex[-1] = expanded
                values[-1] = expanded_value
            else:
                simplex[-1] = reflected
                values[-1] = reflected_value
        elif reflected_value < values[-2]:
            simplex[-1] = reflected
            values[-1] = reflected_value
        else:
            contracted = centroid + 0.5 * (worst - centroid)
            contracted[2] = max(1, contracted[2])
            contracted_value = equilateral_loss(contracted, fit_points)

            if contracted_value < values[-1]:
                simplex[-1] = contracted
                values[-1] = contracted_value
            else:
                for i in range(1, len(simplex)):
                    simplex[i] = simplex[0] + 0.5 * (simplex[i] - simplex[0])
                    simplex[i][2] = max(1, simplex[i][2])
                    values[i] = equilateral_loss(simplex[i], fit_points)

    return equilateral_vertices(simplex[np.argmin(values)])


def score_triangle(points, triangle, brush_size):
    distances = []
    for i in range(3):
        distances.append(distance_to_segment(points, triangle[i], triangle[(i + 1) % 3]))
    min_distances = np.min(np.column_stack(distances), axis=1)
    return np.mean(min_distances <= brush_size / 2.0) * 100


def fit_circle_to_points(points, fit_mode, brush_size):
    x = points[:, 0]
    y = points[:, 1]

    A = np.column_stack([2*x, 2*y, np.ones_like(x)])
    b = x**2 + y**2
    c, residuals, rank, s = np.linalg.lstsq(A, b, rcond=None)
    xc, yc, w = c
    R_sq = w + xc**2 + yc**2

    if R_sq <= 0:
        return None, 0.0

    R = np.sqrt(R_sq)

    if fit_mode == "geometric":
        for _ in range(10):
            dx = xc - x
            dy = yc - y
            d = np.sqrt(dx**2 + dy**2)

            valid = d > 0
            if not np.any(valid):
                break

            v_dx = dx[valid]
            v_dy = dy[valid]
            v_d = d[valid]

            J = np.column_stack([v_dx/v_d, v_dy/v_d, -np.ones_like(v_d)])
            f = v_d - R

            try:
                delta, _, _, _ = np.linalg.lstsq(J, -f, rcond=None)
                xc += delta[0]
                yc += delta[1]
                R += delta[2]
            except np.linalg.LinAlgError:
                break

    if R >= 5000:
        return None, 0.0

    dist = np.sqrt((x - xc)**2 + (y - yc)**2)
    intersect = np.abs(dist - R) <= brush_size / 2.0
    percent = np.mean(intersect) * 100
    return (int(xc), int(yc), int(R)), percent


def main():
    clock = pygame.time.Clock()
    
    # Create surface for drawing so it doesn't get cleared when we update the UI
    canvas = pygame.Surface((WIDTH, HEIGHT - PANEL_HEIGHT))
    canvas.fill(WHITE)
    
    buttons = [
        Button(10, 10, 100, 30, "Pen", "pen"),
        Button(120, 10, 100, 30, "Eraser", "eraser"),
        Button(230, 10, 100, 30, "Clear", "clear"),
        Button(340, 10, 130, 30, "Shape: Circle", "shape_toggle"),
        Button(480, 10, 130, 30, "Fit: Geo", "fit_toggle")
    ]
    
    mode = "pen"
    fit_shape = "circle"
    fit_mode = "geometric"
    drawing = False
    last_pos = None
    brush_size = 5
    eraser_size = 20
    
    fit_overlay = None
    percent = 0.0
    canvas_changed = False
    
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1: # Left click
                    if event.pos[1] < PANEL_HEIGHT:
                        # Check button clicks
                        for button in buttons:
                            if button.rect.collidepoint(event.pos):
                                if button.action_mode == "clear":
                                    canvas.fill(WHITE)
                                    canvas_changed = True
                                elif button.action_mode == "shape_toggle":
                                    if fit_shape == "circle":
                                        fit_shape = "triangle"
                                        button.text = "Shape: Tri"
                                    else:
                                        fit_shape = "circle"
                                        button.text = "Shape: Circle"
                                    canvas_changed = True
                                elif button.action_mode == "fit_toggle":
                                    if fit_mode == "algebraic":
                                        fit_mode = "geometric"
                                        button.text = "Fit: Geo"
                                    else:
                                        fit_mode = "algebraic"
                                        button.text = "Fit: Alg"
                                    canvas_changed = True
                                else:
                                    mode = button.action_mode
                    else:
                        # Start drawing
                        drawing = True
                        last_pos = (event.pos[0], event.pos[1] - PANEL_HEIGHT)
                        
                        # Draw a single point in case the user just clicks without moving
                        current_pos = last_pos
                        color = BLACK if mode == "pen" else WHITE
                        size = brush_size if mode == "pen" else eraser_size
                        pygame.draw.circle(canvas, color, current_pos, size // 2)
                        canvas_changed = True
                        
            elif event.type == pygame.MOUSEBUTTONUP:
                if event.button == 1:
                    drawing = False
                    last_pos = None
                    
            elif event.type == pygame.MOUSEMOTION:
                if drawing:
                    current_pos = (event.pos[0], event.pos[1] - PANEL_HEIGHT)
                    color = BLACK if mode == "pen" else WHITE
                    size = brush_size if mode == "pen" else eraser_size
                    
                    if last_pos is not None:
                        # Draw line between previous position and current position for smooth drawing
                        pygame.draw.line(canvas, color, last_pos, current_pos, size)
                        # Draw circle at ends to make line round and smooth
                        pygame.draw.circle(canvas, color, current_pos, size // 2)
                    last_pos = current_pos
                    canvas_changed = True

        if canvas_changed:
            # We must lock array for short time, delete to unlock so we can blit
            arr = pygame.surfarray.pixels3d(canvas)
            points = np.argwhere(np.all(arr == BLACK, axis=-1))
            del arr  # unlock the surface
            
            if len(points) > 3:
                try:
                    if fit_shape == "triangle":
                        triangle = fit_triangle(points)
                        if triangle is not None:
                            fit_overlay = ("triangle", triangle.astype(int))
                            percent = score_triangle(points, triangle, brush_size)
                        else:
                            fit_overlay = None
                            percent = 0.0
                    else:
                        circle, percent = fit_circle_to_points(points, fit_mode, brush_size)
                        fit_overlay = ("circle", circle) if circle is not None else None
                except np.linalg.LinAlgError:
                    fit_overlay = None
                    percent = 0.0
            else:
                fit_overlay = None
                percent = 0.0
                
            canvas_changed = False

        # Draw background for the top panel
        screen.fill(GRAY) 
        
        # Draw canvas
        screen.blit(canvas, (0, PANEL_HEIGHT))
        
        # Overlay the fitted shape
        if fit_overlay is not None:
            overlay_type, overlay_shape = fit_overlay
            if overlay_type == "circle":
                xc, yc, R = overlay_shape
                thickness = min(brush_size, max(1, R))
                pygame.draw.circle(screen, RED, (xc, yc + PANEL_HEIGHT), R, thickness)
            else:
                triangle = [(int(x), int(y + PANEL_HEIGHT)) for x, y in overlay_shape]
                pygame.draw.polygon(screen, RED, triangle, brush_size)
            
        # Draw buttons
        for button in buttons:
            button.draw(screen, mode)
            
        # Draw percentage text
        percent_surf = font.render(f"Intersecting: {percent:.1f}%", True, BLACK)
        screen.blit(percent_surf, (620, 15))
            
        # Draw panel divider
        pygame.draw.line(screen, BLACK, (0, PANEL_HEIGHT), (WIDTH, PANEL_HEIGHT), 2)
            
        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()

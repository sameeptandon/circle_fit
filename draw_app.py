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

def main():
    clock = pygame.time.Clock()
    
    # Create surface for drawing so it doesn't get cleared when we update the UI
    canvas = pygame.Surface((WIDTH, HEIGHT - PANEL_HEIGHT))
    canvas.fill(WHITE)
    
    buttons = [
        Button(10, 10, 100, 30, "Pen", "pen"),
        Button(120, 10, 100, 30, "Eraser", "eraser"),
        Button(230, 10, 100, 30, "Clear", "clear")
    ]
    
    mode = "pen"
    drawing = False
    last_pos = None
    brush_size = 5
    eraser_size = 20
    
    fit_circle = None
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
                x = points[:, 0]
                y = points[:, 1]
                
                A = np.column_stack([2*x, 2*y, np.ones_like(x)])
                b = x**2 + y**2
                try:
                    c, residuals, rank, s = np.linalg.lstsq(A, b, rcond=None)
                    xc, yc, w = c
                    R_sq = w + xc**2 + yc**2
                    
                    if R_sq > 0:
                        R = np.sqrt(R_sq)
                        if R < 5000: # prevent drawing extremely large circles
                            fit_circle = (int(xc), int(yc), int(R))
                            
                            # Percentage calculation
                            # distance from each point to center
                            dist = np.sqrt((x - xc)**2 + (y - yc)**2)
                            # point is within half the brush size of the radius
                            intersect = np.abs(dist - R) <= brush_size / 2.0
                            percent = np.mean(intersect) * 100
                        else:
                            fit_circle = None
                    else:
                        fit_circle = None
                except np.linalg.LinAlgError:
                    fit_circle = None
            else:
                fit_circle = None
                percent = 0.0
                
            canvas_changed = False

        # Draw background for the top panel
        screen.fill(GRAY) 
        
        # Draw canvas
        screen.blit(canvas, (0, PANEL_HEIGHT))
        
        # Overlay the fit circle
        if fit_circle is not None:
            xc, yc, R = fit_circle
            # Ensure width is valid for pygame (width > 0 and width <= R)
            thickness = min(brush_size, max(1, R))
            pygame.draw.circle(screen, RED, (xc, yc + PANEL_HEIGHT), R, thickness)
            
        # Draw buttons
        for button in buttons:
            button.draw(screen, mode)
            
        # Draw percentage text
        percent_surf = font.render(f"Intersecting: {percent:.1f}%", True, BLACK)
        screen.blit(percent_surf, (350, 15))
            
        # Draw panel divider
        pygame.draw.line(screen, BLACK, (0, PANEL_HEIGHT), (WIDTH, PANEL_HEIGHT), 2)
            
        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()

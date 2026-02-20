# Design Tokens Documentation

This document outlines the design system tokens used throughout the chess application.

## Color Tokens

### Primary Colors
- `--color-primary: #3498db` - Main brand color (blue)
- `--color-primary-hover: #2980b9` - Hover state for primary color
- `--color-success: #28a745` - Success state (green)
- `--color-success-hover: #218838` - Hover state for success
- `--color-danger: #e74c3c` - Error/danger state (red)
- `--color-danger-hover: #c0392b` - Hover state for danger
- `--color-purple: #6f42c1` - Accent/focus color
- `--color-purple-hover: #5a32a3` - Hover state for purple

### Text Colors
- `--color-text: #333` - Primary text color (dark gray)
- `--color-text-secondary: #555` - Secondary text (medium gray)
- `--color-text-muted: #666` - Muted text
- `--color-text-light: #767676` - Light text for hints/placeholders
- `--color-text-darkest: #1a1a1a` - Darkest text for high emphasis (added for design compliance)

### Border & Surface Colors
- `--color-border: #ddd` - Light border color
- `--color-border-dark: #333` - Dark border color
- `--color-disabled: #bdc3c7` - Disabled state
- `--color-surface: #f5f5f5` - Background surface
- `--color-surface-alt: #fafafa` - Alternate surface
- `--color-card-bg: #fff` - Card background (white)

### Chess Board Colors
- `--color-board-light: #f0d9b5` - Light squares
- `--color-board-dark: #b58863` - Dark squares
- `--color-board-frame: #6d4c2e` - Board frame (walnut)
- `--color-board-frame-shadow: #5a3e24` - Frame shadow
- `--color-selected: #7fa650` - Selected piece highlight
- `--color-suggested: #9dc3e6` - Suggested move indicator
- `--color-last-move: #cdd26a` - Last move highlight

### Semantic Colors
- `--color-accent-blue-bg: #e8f4fd` - Light blue background
- `--color-accent-blue-hover: #f0f7ff` - Light blue hover
- `--color-code-bg: #1e1e1e` - Code block background
- `--color-code-text: #d4d4d4` - Code text color
- `--color-code-inline-bg: #e8e8e8` - Inline code background
- `--color-success-bg: #d4edda` - Success background
- `--color-success-border: #c3e6cb` - Success border
- `--color-success-text: #155724` - Success text
- `--color-error-bg: #f8d7da` - Error background
- `--color-error-border: #f5c6cb` - Error border
- `--color-error-text: #721c24` - Error text

## Spacing Tokens

### Consistent Scale (4px base)
- `--space-1: 4px` - Smallest spacing unit (use for borders, not layout)
- `--space-2: 8px` - Extra small spacing
- `--space-4: 16px` - Small spacing
- `--space-6: 24px` - Medium spacing
- `--space-8: 32px` - Large spacing
- `--space-12: 48px` - Extra large spacing

### Legacy Spacing (for gradual migration)
- `--space-1.5: 6px`
- `--space-2.5: 10px`
- `--space-3: 12px`
- `--space-3.5: 14px`
- `--space-3.75: 15px`
- `--space-5: 24px` (duplicate of --space-6, prefer --space-6)

**Note**: `--space-1` (4px) should NOT be used for semantic purposes like border widths. Use explicit pixel values for borders to avoid semantic confusion.

## Border Radius Tokens
- `--radius-sm: 4px` - Small radius
- `--radius-md: 6px` - Medium radius
- `--radius-lg: 8px` - Large radius
- `--radius-xl: 10px` - Extra large radius

## Typography Tokens

### Font Sizes
- `--font-size-xs: 0.75rem` (12px)
- `--font-size-sm: 0.875rem` (14px)
- `--font-size-base: 1rem` (16px)
- `--font-size-lg: 1.125rem` (18px)
- `--font-size-xl: 1.25rem` (20px)
- `--font-size-2xl: 1.5rem` (24px)
- `--font-size-3xl: 1.875rem` (30px)
- `--font-size-4xl: 2.25rem` (36px)

### Line Heights
- `--line-height-tight: 1.25` - For headings
- `--line-height-normal: 1.5` - For body text
- `--line-height-relaxed: 1.6` - For long-form content

### Font Weights
- `--font-weight-normal: 400`
- `--font-weight-medium: 500`
- `--font-weight-semibold: 600`
- `--font-weight-bold: 700`

## Animation & Transition Durations

**Standardized durations** (as of latest design system compliance):

- **150ms** - Fast animations (quick hover effects, small transforms)
- **250ms** - Medium animations (button interactions, color transitions, most UI feedback)
- **400ms** - Slow animations (modals, slide-ins, larger transitions)

### Usage Guidelines
- Use **150ms** for: hover scale effects, quick color changes
- Use **250ms** for: button states, tab transitions, general UI interactions
- Use **400ms** for: modal animations, panel slides, page transitions

## Design System Compliance Notes

### Recent Fixes (2024)
1. **Added `--color-text-darkest`**: For high-emphasis text that requires #1a1a1a
2. **Player bar borders**: Changed from `var(--space-1)` to explicit `4px` to avoid semantic confusion between spacing and border width
3. **Bot language badge**: Added 1px border (#b8daef) for better visual definition while maintaining WCAG AA contrast
4. **Animation standardization**: Migrated from ad-hoc durations (200ms, 300ms) to standardized scale (150ms, 250ms, 400ms)

### Best Practices
- Always use design tokens instead of hardcoded values
- Exception: Explicit pixel values for borders (e.g., `4px solid`) to distinguish from spacing semantics
- Maintain WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI components)
- Use semantic token names (e.g., `--color-text-darkest` not `--color-1a1a1a`)

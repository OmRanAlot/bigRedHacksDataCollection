import type { Category } from '../types/handwriting'

export const GLYPHS: Record<Category, string[]> = {
  digits: Array.from('0123456789'),
  lowercase: Array.from('abcdefghijklmnopqrstuvwxyz'),
  uppercase: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  operators: ['+', '-', '×', '÷', '/', '=', '≠', '<', '>', '≤', '≥', '(', ')', '[', ']', '{', '}', '^', '.', ',', ':', '√', '∫', '∑', '∂', '∞', '±'],
  greek: Array.from('αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΞΠΣΦΨΩ'),
}

export const CATEGORY_NAMES: Record<Category, string> = {
  digits: 'Digits', lowercase: 'Lowercase', uppercase: 'Uppercase', operators: 'Math symbols', greek: 'Greek',
}

export const EXPRESSIONS = [
  'x + 2 = 5', '2x + 5 = 17', 'x² + 3x + 2', 'x² - 4x + 4',
  'y = mx + b', 'f(x) = x²', 'f(x) = 2x² + 3x - 1', '3x - 7 = 11',
  '(x + 1)(x - 1)', 'x² - y² = (x - y)(x + y)', 'a(b + c) = ab + ac', 'x³ + 8 = 0',
  'y = 2x - 3', 'x + y = 10', '2x + 3y = 12', '|x - 3| = 4',
  'x = (-b ± √(b² - 4ac)) / 2a', 'b² - 4ac ≥ 0', 'x ≠ 0', '-2 < x ≤ 5',
  'dy/dx = 2x', 'dy/dx = 3x² + 4', '∫ x² dx', '∫ 3x² dx',
  '∫ sin(x) dx = -cos(x) + C', '∫ 1/x dx = ln|x| + C', '∫ eˣ dx = eˣ + C', '∫₀¹ x dx = 1/2',
  'd/dx [sin(x)] = cos(x)', 'd/dx [ln(x)] = 1/x', 'f′(x) = 3x²', 'f″(x) = 6x',
  'lim x→0 sin(x)/x = 1', 'lim n→∞ 1/n = 0', '∂f/∂x', '∂²f/∂y²',
  '∇f = (∂f/∂x, ∂f/∂y)', 'dy = 2x dx', '∫₀^π sin(x) dx = 2', 'd/dt [t³] = 3t²',
  'sin(θ) = 1/2', 'cos(θ) = 0', 'sin²(θ) + cos²(θ) = 1', 'tan(θ) = sin(θ)/cos(θ)',
  'sin(2θ) = 2sin(θ)cos(θ)', 'cos(2θ) = 1 - 2sin²(θ)', 'θ = π/4', 'sin(π/2) = 1',
  'cos(π) = -1', 'tan(π/4) = 1', 'α + β + γ = π', 'sin(α + β)',
  'cos(α - β)', 'r = 2cos(θ)', 'x = r cos(θ)', 'y = r sin(θ)',
  'a² + b² = c²', 'A = πr²', 'C = 2πr', 'V = 4πr³/3',
  'A = bh/2', 'V = πr²h', 'd = √((x₂ - x₁)² + (y₂ - y₁)²)', 'm = (y₂ - y₁)/(x₂ - x₁)',
  '(x - h)² + (y - k)² = r²', 'A = 2lw + 2lh + 2wh', 'P = 2(l + w)', 'V = lwh',
  '∑ i', '∑ᵢ₌₁ⁿ i = n(n + 1)/2', '∑ᵢ₌₁ⁿ i²', '∑ᵢ₌₀ⁿ rⁱ',
  '∑ 1/n² = π²/6', 'aₙ = a₁ + (n - 1)d', 'aₙ = arⁿ⁻¹', 'Sₙ = n(a₁ + aₙ)/2',
  '∏ᵢ₌₁ⁿ i = n!', 'Fₙ = Fₙ₋₁ + Fₙ₋₂', '∑ (xᵢ - μ)²', 'x̄ = (∑ xᵢ)/n',
  'e^(iπ) + 1 = 0', 'λ = c/ν', 'ω = 2πf', 'Δx = x₂ - x₁',
  'ρ = m/V', 'σ² = E[(X - μ)²]', 'φ = (1 + √5)/2', 'ε > 0',
  'δ < ε/2', 'ψ(x) = A sin(kx)', 'Γ(n) = (n - 1)!', 'Ω = {1, 2, 3}',
  '1/2 + 1/3 = 5/6', '(a + b)/c = a/c + b/c', 'x/3 = 7/9', 'a/b = c/d',
  '1/(1 + x)', '(x² - 1)/(x - 1) = x + 1', '3/4 - 1/8 = 5/8', '(2/3) × (9/4) = 3/2',
  'aⁿ × aᵐ = aⁿ⁺ᵐ', '(aᵐ)ⁿ = aᵐⁿ', 'x⁻² = 1/x²', '√(x²) = |x|',
  '2¹⁰ = 1024', 'log₂(8) = 3', 'ln(eˣ) = x', 'eˣ > 0',
  'P(A ∩ B) = P(A)P(B)', 'P(A ∪ B) = P(A) + P(B) - P(A ∩ B)', 'E[X] = ∑ xP(x)', '0 ≤ P(A) ≤ 1',
  'n! = n(n - 1)!', '[a, b] = {x : a ≤ x ≤ b}', 'f: A → B', 'x ∈ ℝ',
  'A ∩ B = ∅', '∀x > 0, x² > 0', 'det(A) = ad - bc', 'z = a + bi',
]

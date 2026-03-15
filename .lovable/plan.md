

# Plano: Preview visual de Temperature no painel da Persona

## O que será feito
Substituir o input numérico de temperature por um **Slider visual** com um painel de preview que mostra em tempo real como diferentes valores de temperature afetam o estilo das respostas.

## Componente: `TemperaturePreview`
Novo componente que exibe:
- **Slider** (0 a 2, step 0.1) com cores gradientes (azul→verde→laranja→vermelho)
- **Label dinâmico** que muda conforme o valor: "Preciso e Consistente" (0-0.3), "Equilibrado" (0.4-0.7), "Criativo" (0.8-1.2), "Muito Criativo" (1.3-2.0)
- **Card de preview** com exemplo de resposta simulada para cada faixa, mostrando a diferença de tom/estilo
- Ícone e cor de fundo que mudam conforme a faixa

## Exemplo de preview por faixa
| Faixa | Label | Exemplo |
|---|---|---|
| 0–0.3 | Preciso | "O prazo de entrega é de 3 a 5 dias úteis." |
| 0.4–0.7 | Equilibrado | "Seu pedido deve chegar em 3 a 5 dias úteis. Posso ajudar com mais alguma coisa?" |
| 0.8–1.2 | Criativo | "Ótima notícia! Seu pedido está a caminho e deve chegar em breve, entre 3 e 5 dias úteis 🚀" |
| 1.3–2.0 | Experimental | "Seu pedido já está voando rumo a você! Em uns 3 a 5 dias úteis ele bate na sua porta 📦✨" |

## Arquivos alterados
1. **Novo**: `src/components/settings/TemperaturePreview.tsx` — componente de slider + preview
2. **Editar**: `src/components/PersonaDialog.tsx` — substituir o `<Input type="number">` pelo novo `TemperaturePreview`

## Impacto
- Apenas frontend, nenhuma alteração de banco
- Usa o componente `Slider` já existente em `src/components/ui/slider.tsx`


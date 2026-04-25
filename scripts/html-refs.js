import { readFileSync, writeFileSync } from 'fs'

const mode = process.argv[2] // 'min' or 'dev'
if (mode !== 'min' && mode !== 'dev') {
  console.error('Usage: node scripts/html-refs.js <min|dev>')
  process.exit(1)
}

let html = readFileSync('index.html', 'utf8')

if (mode === 'min') {
  html = html
    .replace('href="lightmodal.css"', 'href="lightmodal.min.css"')
    .replace('src="lightmodal.js"', 'src="lightmodal.min.js"')
} else {
  html = html
    .replace('href="lightmodal.min.css"', 'href="lightmodal.css"')
    .replace('src="lightmodal.min.js"', 'src="lightmodal.js"')
}

writeFileSync('index.html', html)
console.log(`index.html → ${mode === 'min' ? 'lightmodal.min.*' : 'lightmodal.*'}`)

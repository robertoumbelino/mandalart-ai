import Image from 'next/image'
import './testimonials.css'

const testimonials = [
  {
    name: 'Kauã Santos',
    quote: 'O Mandalart é excepcional! Me ajudou muito a criar um plano com passos que realmente me aproximassem dos objetivos que eu tanto queria. Tinha um objetivo específico que tentava realizar havia anos e já tinha criado inúmeras estratégias, mas, por falta de um plano, nunca conseguia finalizar. Depois de conhecer e testar o Mandalart, finalmente consegui tirar esse plano do papel e realizar meu objetivo, um passo de cada vez, seguindo os checklists que o aplicativo nos dá! Bom demais!',
    subtitle: 'Plano e checklists',
    photo: '/testimonials/kaua-santos.png'
  },
  {
    name: 'Roberto Umbelino',
    quote: 'Eu já tinha tentado organizar esse objetivo algumas vezes e sempre acabava deixando pra depois. O que eu gostei foi poder abrir o plano e ver uma coisa de cada vez. Ainda estou fazendo aos poucos, mas parei de ficar só pensando por onde começar.',
    subtitle: 'Um passo de cada vez',
    photo: '/testimonials/roberto-umbelino.png'
  },
  {
    name: 'Pablo Danilo Mota',
    quote: 'Achei legal ter as tarefas separadas. Quando tenho um tempo, entro, vejo o que dá pra fazer e marco o que já fiz. Parece simples, mas pra mim isso faz diferença.',
    subtitle: 'Tarefas no dia a dia',
    photo: '/testimonials/pablo-danilo-mota.png'
  },
  {
    name: 'Caynã Schmidt',
    quote: 'Eu sou daqueles que anota um monte de ideia e depois não sabe nem onde deixou. Aqui ficou tudo junto. Tem dias que faço só uma tarefa, tem dias que não faço nenhuma, mas quando volto consigo continuar sem ter que começar do zero.',
    subtitle: 'Progresso no próprio ritmo',
    photo: '/testimonials/cayna-schmidt.png'
  }
] as const

export function Testimonials() {
  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <div className="testimonials-heading">
        <span className="testimonials-eyebrow">HISTÓRIAS DE QUEM COMEÇOU</span>
        <h2 id="testimonials-title">Um passo de cada vez, na vida real.</h2>
        <p>Uma experiência de quem já usou o Mandalart para transformar um objetivo em ações.</p>
        <span className="testimonials-preview-note">Prévia do layout · três textos ilustrativos</span>
      </div>

      <div className="testimonials-grid">
        {testimonials.map(({ name, quote, subtitle, ...person }, index) => (
          <figure
            className={`testimonial-card ${index === 0 ? 'testimonial-card-featured' : ''} ${index === 3 ? 'testimonial-card-wide' : ''}`}
            key={name}
          >
            <span className="testimonial-quote-mark" aria-hidden="true">“</span>
            <blockquote><p>{quote}</p></blockquote>
            <figcaption>
              {'photo' in person ? (
                <Image src={person.photo} alt="" width={48} height={48} className="testimonial-avatar testimonial-avatar-photo" />
              ) : (
                <span className="testimonial-avatar testimonial-avatar-initial" aria-hidden="true">{name.charAt(0)}</span>
              )}
              <span className="testimonial-person">
                <strong>{name}</strong>
                <span>{subtitle}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

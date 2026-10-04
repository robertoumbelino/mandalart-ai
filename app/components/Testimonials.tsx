import Image from 'next/image'
import { caynaTestimonial, kauaTestimonial } from '@/lib/testimonials'
import './testimonials.css'

const testimonials = [
  kauaTestimonial,
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
  caynaTestimonial
] as const

export function Testimonials() {
  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <div className="testimonials-heading">
        <span className="testimonials-eyebrow">HISTÓRIAS DE QUEM COMEÇOU</span>
        <h2 id="testimonials-title">Um passo de cada vez, na vida real.</h2>
        <p>Experiências de quem já usou o Mandalart para transformar um objetivo em ações.</p>
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

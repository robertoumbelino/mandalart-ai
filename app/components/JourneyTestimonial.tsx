import Image from 'next/image'
import { caynaTestimonial, kauaTestimonial } from '@/lib/testimonials'
import styles from './journey-testimonial.module.css'

const excerpts = {
  generation: { person: kauaTestimonial, quote: 'Me ajudou muito a criar um plano com passos que realmente me aproximassem dos objetivos que eu tanto queria.' },
  purchase: { person: caynaTestimonial, quote: 'Aqui ficou tudo junto. Tem dias que faço só uma tarefa, tem dias que não faço nenhuma, mas quando volto consigo continuar sem ter que começar do zero.' }
} as const

export function JourneyTestimonial({ placement }: { placement: keyof typeof excerpts }) {
  const { person, quote } = excerpts[placement]
  return (
    <figure className={`${styles.testimonial} ${styles[placement]}`} aria-label="Depoimento de quem usou o Mandalart">
      <blockquote><p>“{quote}”</p></blockquote>
      <figcaption>
        <Image src={person.photo} alt="" width={40} height={40} />
        <span><strong>{person.name}</strong><small>{person.subtitle}</small></span>
      </figcaption>
    </figure>
  )
}

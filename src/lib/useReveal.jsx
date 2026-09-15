import { useEffect, useRef, useState } from 'react'

// Hook kecil buat animasi "fade up pas discroll" — dipakai di semua section
// landing page. Cuma jalan sekali (begitu kelihatan, langsung disconnect).
export function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return [ref, visible]
}

// Hook animasi angka "count-up" — dipakai buat nominal KPI di dashboard mockup,
// jalan sekali begitu section-nya kelihatan di layar.
export function useCountUp(target, visible, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!visible) return
    let raf
    const start = performance.now()
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, target, duration])
  return value
}
export function Reveal({ as: Tag = 'div', className = '', stagger = false, children, ...rest }) {
  const [ref, visible] = useReveal()
  const cls = `${className} lp-reveal ${stagger ? 'lp-stagger' : ''} ${visible ? 'is-visible' : ''}`.trim()
  return (
    <Tag ref={ref} className={cls} {...rest}>
      {children}
    </Tag>
  )
}

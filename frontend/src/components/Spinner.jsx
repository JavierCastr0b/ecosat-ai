export default function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-10 w-10 border-4' : 'h-6 w-6 border-2'
  return (
    <div className={`${s} rounded-full border-nir border-t-transparent animate-spin`} />
  )
}

import star from "../assets/star.svg";

function Loader() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 items-center justify-center gap-3"
      role="status"
      aria-label="Cargando"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <img
          key={index}
          src={star}
          alt=""
          aria-hidden="true"
          className="h-8 w-8 animate-bounce"
          style={{
            animationDelay: `${index * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default Loader;

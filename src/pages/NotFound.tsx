import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-white">404</h1>
        <p className="mb-4 text-xl text-[#999999]">Ops! Página não encontrada</p>
        <a href="/" className="text-[#22c55e] underline hover:text-[#4ADE80]">
          Voltar ao Início
        </a>
      </div>
    </div>
  );
};

export default NotFound;

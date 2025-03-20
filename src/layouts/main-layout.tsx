import { Container } from "@/components/container";
import { Header } from "@/components/header";
import { Footer } from "@/views/footer";
import { Outlet } from "react-router-dom";

const MainLayout = () => {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <Container className="flex-grow">
        <main className="flex-grow">
          <Outlet />
        </main>
      </Container>

      {/* footer */}
      <Footer />
    </div>
  );
};

export default MainLayout;

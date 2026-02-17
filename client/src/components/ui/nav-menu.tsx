import { Link, useLocation } from "react-router-dom";
import { Button } from "./button";
import { Home, User, LogOut, Shield, Menu } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User as UserType } from "@shared/schema";
import { logout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

interface UserResponse {
  user: UserType;
  subscriptions: Subscription[];
}

interface Subscription {
  id: number;
  userId: number;
  tier: string;
  status: string;
  vatNumber: string | null;
  createdAt: string;
}

export function NavMenu() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { data: userData } = useQuery<UserResponse>({
    queryKey: ["/api/user"],
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async () => {
    try {
      await logout();
      queryClient.setQueryData(["/api/user"], null);
      setIsOpen(false);
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account",
      });
      // Redirect after successful logout
      window.location.href = "/auth";
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const NavLinks = () => (
    <>
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <Link to="/" className="flex items-center me-16">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              width="6em"
              height="3em"
              viewBox="0 0 148 49.81"
            >
              <defs>
                <clipPath id="clip-path">
                  <rect
                    id="Rectangle_93"
                    data-name="Rectangle 93"
                    width="148"
                    height="49.81"
                    fill="none"
                  ></rect>
                </clipPath>
              </defs>
              <g
                id="Group_117"
                data-name="Group 117"
                transform="translate(0 0)"
              >
                <path
                  id="Path_901"
                  data-name="Path 901"
                  d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
                  transform="translate(0 0)"
                  fill="#ed4c14"
                ></path>
                <g
                  id="Group_116"
                  data-name="Group 116"
                  transform="translate(0 0)"
                >
                  <g
                    id="Group_115"
                    data-name="Group 115"
                    clipPath="url(#clip-path)"
                  >
                    <path
                      id="Path_902"
                      data-name="Path 902"
                      d="M61.828,22.27V38.076H53.823V23.5c0-4.465-2.052-6.518-5.594-6.518-3.849,0-6.619,2.362-6.619,7.441V38.076H33.6V0H41.61V13.34a12.138,12.138,0,0,1,8.775-3.285c6.517,0,11.444,3.8,11.444,12.215"
                      transform="translate(-6.611 0)"
                      fill="#00398e"
                    ></path>
                    <path
                      id="Path_903"
                      data-name="Path 903"
                      d="M102.242,12.917v27.61H94.6v-3.18c-2,2.41-4.927,3.591-8.622,3.591-7.8,0-13.8-5.542-13.8-14.214s6-14.216,13.8-14.216a10.606,10.606,0,0,1,8.263,3.338V12.917ZM94.39,26.723c0-4.774-3.079-7.648-7.03-7.648-4,0-7.082,2.874-7.082,7.648s3.079,7.646,7.082,7.646c3.951,0,7.03-2.873,7.03-7.646"
                      transform="translate(-14.197 -2.46)"
                      fill="#00398e"
                    ></path>
                    <path
                      id="Path_904"
                      data-name="Path 904"
                      d="M140.745,13.019V37.388c0,10.264-5.388,14.983-15.037,14.983-5.08,0-10.006-1.282-13.187-3.8l3.182-5.747a15.335,15.335,0,0,0,9.339,3.079c5.388,0,7.7-2.514,7.7-7.494V37.49a11.314,11.314,0,0,1-8.159,3.183c-6.928,0-11.8-3.849-11.8-12.42V13.019h8.006V27.072c0,4.67,2.053,6.723,5.594,6.723,3.7,0,6.364-2.362,6.364-7.44V13.019Z"
                      transform="translate(-22.135 -2.561)"
                      fill="#00398e"
                    ></path>
                    <path
                      id="Path_905"
                      data-name="Path 905"
                      d="M149.683,26.724c0-8.315,6.414-14.214,15.395-14.214,5.8,0,10.366,2.513,12.367,7.03l-6.209,3.335a6.881,6.881,0,0,0-6.209-3.8c-4.054,0-7.236,2.821-7.236,7.646s3.182,7.646,7.236,7.646a6.794,6.794,0,0,0,6.209-3.8l6.209,3.386c-2,4.414-6.569,6.979-12.367,6.979-8.981,0-15.395-5.9-15.395-14.214"
                      transform="translate(-29.445 -2.461)"
                      fill="#00398e"
                    ></path>
                  </g>
                </g>
              </g>
            </svg>
          </Link>
        </div>
        {pathname !== "/dashboard" && pathname !== "/reviews-program" && (
          <>
            <Link to="/">
              <Button
                variant={pathname === "/" ? "default" : "ghost"}
                className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/"
                    ? "bg-[#182B53] text-white"
                    : "text-[#182B53] hover:bg-accent"
                  }`}
              >
                {t("nav.home")}
              </Button>
            </Link>

            <Link to="/templates">
              <Button
                variant={pathname === "/templates" ? "default" : "ghost"}
                className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/templates"
                    ? "bg-[#182B53] text-white"
                    : "text-[#182B53] hover:bg-accent"
                  }`}
              >
                {t("nav.templates")}
              </Button>
            </Link>

            <Link to="/about">
              <Button
                variant={pathname === "/about" ? "default" : "ghost"}
                className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/about"
                    ? "bg-[#182B53] text-white"
                    : "text-[#182B53] hover:bg-accent"
                  }`}
              >
                {t("nav.about")}
              </Button>
            </Link>

            <Link to="/contact">
              <Button
                variant={pathname === "/contact" ? "default" : "ghost"}
                className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/contact"
                    ? "bg-[#182B53] text-white"
                    : "text-[#182B53] hover:bg-accent"
                  }`}
              >
                {t("nav.contact")}
              </Button>
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {(userData?.user?.role === "administrator" || userData?.user?.role === "moderator") && (
          <Link to="/admin">
            <Button
              variant={pathname === "/admin" ? "default" : "ghost"}
              className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/admin"
                  ? "bg-[#182B53] text-white"
                  : "text-[#182B53] hover:bg-accent"
                }`}
            >
              <Shield className="h-4 w-4 mr-2" />
              {t("nav.adminDashboard")}
            </Button>
          </Link>
        )}

        {userData?.user ? (
          <>
            {userData.user.role !== "administrator" && (
              <>
                <Link to="/dashboard">
                  <Button
                    variant={pathname === "/dashboard" ? "default" : "ghost"}
                    className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/dashboard"
                        ? "bg-[#182B53] text-white"
                        : "text-[#182B53] hover:bg-accent"
                      }`}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Link to="/profile">
                  <Button
                    variant={pathname === "/profile" ? "default" : "ghost"}
                    className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/profile"
                      ? "bg-[#182B53] text-white"
                      : "text-[#182B53] hover:bg-accent"
                      }`}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t("nav.myAccount") || "My Account"}
                  </Button>
                </Link>
              </>
            )}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full md:w-auto justify-start md:justify-center border-0 text-[#182B53] hover:bg-accent"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("actions.logout")}
            </Button>
          </>
        ) : (
          <Link to="/auth">
            <Button
              variant={pathname === "/auth" ? "default" : "ghost"}
              className={`w-full md:w-auto justify-start md:justify-center border-0 ${pathname === "/auth"
                  ? "bg-[#182B53] text-white"
                  : "text-[#182B53] hover:bg-accent"
                }`}
            >
              <User className="h-4 w-4 mr-2" />
              {t("actions.login")}
            </Button>
          </Link>
        )}

        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => {
              i18n.changeLanguage("en");
              localStorage.setItem("language", "en");
            }}
            className={`px-2 py-1 text-sm rounded bg-background border text-[#182B53] hover:bg-accent flex items-center justify-center ${i18n.language === "en" ? "border-primary" : ""}`}
            aria-label="English"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="24" height="16">
              <clipPath id="uk1"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
              <clipPath id="uk2"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
              <g clipPath="url(#uk1)">
                <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
                <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk2)" stroke="#C8102E" strokeWidth="4"/>
                <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
                <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
              </g>
            </svg>
          </button>
          <button
            onClick={() => {
              i18n.changeLanguage("gr");
              localStorage.setItem("language", "gr");
            }}
            className={`px-2 py-1 text-sm rounded bg-background border text-[#182B53] hover:bg-accent flex items-center justify-center ${i18n.language === "gr" ? "border-primary" : ""}`}
            aria-label="Greek"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 18" width="24" height="16">
              <rect fill="#0D5EAF" width="27" height="18"/>
              <path fill="#FFF" d="M0,2h27v2H0zM0,6h27v2H0zM0,10h27v2H0zM0,14h27v2H0z"/>
              <rect fill="#0D5EAF" width="10" height="10"/>
              <path fill="#FFF" d="M0,4h10v2H0zM4,0h2v10H4z"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <nav className="border-b fixed w-full bg-background z-50">
      <div className="container px-4 h-16 flex items-center mx-auto justify-end">
        {/* Mobile Menu */}
        <div className="md:hidden flex justify-between w-full gap-3">
          {/* Logo - only show when menu is closed */}
          {!isOpen && (
            <Link to="/" className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                width="5em"
                height="2.5em"
                viewBox="0 0 148 49.81"
              >
                <defs>
                  <clipPath id="clip-path-mobile-header">
                    <rect
                      id="Rectangle_93"
                      data-name="Rectangle 93"
                      width="148"
                      height="49.81"
                      fill="none"
                    ></rect>
                  </clipPath>
                </defs>
                <g
                  id="Group_117"
                  data-name="Group 117"
                  transform="translate(0 0)"
                >
                  <path
                    id="Path_901"
                    data-name="Path 901"
                    d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
                    transform="translate(0 0)"
                    fill="#ed4c14"
                  ></path>
                  <g
                    id="Group_116"
                    data-name="Group 116"
                    transform="translate(0 0)"
                  >
                    <g
                      id="Group_115"
                      data-name="Group 115"
                      clipPath="url(#clip-path-mobile-header)"
                    >
                      <path
                        id="Path_902"
                        data-name="Path 902"
                        d="M61.828,22.27V38.076H53.823V23.5c0-4.465-2.052-6.518-5.594-6.518-3.849,0-6.619,2.362-6.619,7.441V38.076H33.6V0H41.61V13.34a12.138,12.138,0,0,1,8.775-3.285c6.517,0,11.444,3.8,11.444,12.215"
                        transform="translate(-6.611 0)"
                        fill="#00398e"
                      ></path>
                      <path
                        id="Path_903"
                        data-name="Path 903"
                        d="M102.242,12.917v27.61H94.6v-3.18c-2,2.41-4.927,3.591-8.622,3.591-7.8,0-13.8-5.542-13.8-14.214s6-14.216,13.8-14.216a10.606,10.606,0,0,1,8.263,3.338V12.917ZM94.39,26.723c0-4.774-3.079-7.648-7.03-7.648-4,0-7.082,2.874-7.082,7.648s3.079,7.646,7.082,7.646c3.951,0,7.03-2.873,7.03-7.646"
                        transform="translate(-14.197 -2.46)"
                        fill="#00398e"
                      ></path>
                      <path
                        id="Path_904"
                        data-name="Path 904"
                        d="M140.745,13.019V37.388c0,10.264-5.388,14.983-15.037,14.983-5.08,0-10.006-1.282-13.187-3.8l3.182-5.747a15.335,15.335,0,0,0,9.339,3.079c5.388,0,7.7-2.514,7.7-7.494V37.49a11.314,11.314,0,0,1-8.159,3.183c-6.928,0-11.8-3.849-11.8-12.42V13.019h8.006V27.072c0,4.67,2.053,6.723,5.594,6.723,3.7,0,6.364-2.362,6.364-7.44V13.019Z"
                        transform="translate(-22.135 -2.561)"
                        fill="#00398e"
                      ></path>
                      <path
                        id="Path_905"
                        data-name="Path 905"
                        d="M149.683,26.724c0-8.315,6.414-14.214,15.395-14.214,5.8,0,10.366,2.513,12.367,7.03l-6.209,3.335a6.881,6.881,0,0,0-6.209-3.8c-4.054,0-7.236,2.821-7.236,7.646s3.182,7.646,7.236,7.646a6.794,6.794,0,0,0,6.209-3.8l6.209,3.386c-2,4.414-6.569,6.979-12.367,6.979-8.981,0-15.395-5.9-15.395-14.214"
                        transform="translate(-29.445 -2.461)"
                        fill="#00398e"
                      ></path>
                    </g>
                  </g>
                </g>
              </svg>
            </Link>
          )}

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[80%] sm:w-[385px] flex flex-col gap-4 pt-8"
            >
              <div className="flex items-center mb-6">
                <Link
                  to="/"
                  className="flex items-center"
                  onClick={() => setIsOpen(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    xmlns:xlink="http://www.w3.org/1999/xlink"
                    width="6em"
                    height="3em"
                    viewBox="0 0 148 49.81"
                  >
                    <defs>
                      <clipPath id="clip-path-mobile">
                        <rect
                          id="Rectangle_93"
                          data-name="Rectangle 93"
                          width="148"
                          height="49.81"
                          fill="none"
                        ></rect>
                      </clipPath>
                    </defs>
                    <g
                      id="Group_117"
                      data-name="Group 117"
                      transform="translate(0 0)"
                    >
                      <path
                        id="Path_901"
                        data-name="Path 901"
                        d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
                        transform="translate(0 0)"
                        fill="#ed4c14"
                      ></path>
                      <g
                        id="Group_116"
                        data-name="Group 116"
                        transform="translate(0 0)"
                      >
                        <g
                          id="Group_115"
                          data-name="Group 115"
                          clipPath="url(#clip-path-mobile)"
                        >
                          <path
                            id="Path_902"
                            data-name="Path 902"
                            d="M61.828,22.27V38.076H53.823V23.5c0-4.465-2.052-6.518-5.594-6.518-3.849,0-6.619,2.362-6.619,7.441V38.076H33.6V0H41.61V13.34a12.138,12.138,0,0,1,8.775-3.285c6.517,0,11.444,3.8,11.444,12.215"
                            transform="translate(-6.611 0)"
                            fill="#00398e"
                          ></path>
                          <path
                            id="Path_903"
                            data-name="Path 903"
                            d="M102.242,12.917v27.61H94.6v-3.18c-2,2.41-4.927,3.591-8.622,3.591-7.8,0-13.8-5.542-13.8-14.214s6-14.216,13.8-14.216a10.606,10.606,0,0,1,8.263,3.338V12.917ZM94.39,26.723c0-4.774-3.079-7.648-7.03-7.648-4,0-7.082,2.874-7.082,7.648s3.079,7.646,7.082,7.646c3.951,0,7.03-2.873,7.03-7.646"
                            transform="translate(-14.197 -2.46)"
                            fill="#00398e"
                          ></path>
                          <path
                            id="Path_904"
                            data-name="Path 904"
                            d="M140.745,13.019V37.388c0,10.264-5.388,14.983-15.037,14.983-5.08,0-10.006-1.282-13.187-3.8l3.182-5.747a15.335,15.335,0,0,0,9.339,3.079c5.388,0,7.7-2.514,7.7-7.494V37.49a11.314,11.314,0,0,1-8.159,3.183c-6.928,0-11.8-3.849-11.8-12.42V13.019h8.006V27.072c0,4.67,2.053,6.723,5.594,6.723,3.7,0,6.364-2.362,6.364-7.44V13.019Z"
                            transform="translate(-22.135 -2.561)"
                            fill="#00398e"
                          ></path>
                          <path
                            id="Path_905"
                            data-name="Path 905"
                            d="M149.683,26.724c0-8.315,6.414-14.214,15.395-14.214,5.8,0,10.366,2.513,12.367,7.03l-6.209,3.335a6.881,6.881,0,0,0-6.209-3.8c-4.054,0-7.236,2.821-7.236,7.646s3.182,7.646,7.236,7.646a6.794,6.794,0,0,0,6.209-3.8l6.209,3.386c-2,4.414-6.569,6.979-12.367,6.979-8.981,0-15.395-5.9-15.395-14.214"
                            transform="translate(-29.445 -2.461)"
                            fill="#00398e"
                          ></path>
                        </g>
                      </g>
                    </g>
                  </svg>
                </Link>
              </div>

              {/* Mobile Navigation Links */}
              <div className="flex flex-col gap-4">
                {pathname !== "/dashboard" && (
                  <>
                    <Link to="/" onClick={() => setIsOpen(false)}>
                      <Button
                        variant={pathname === "/" ? "default" : "ghost"}
                        className={`w-full justify-start border-0 ${pathname === "/"
                            ? "bg-[#182B53] text-white"
                            : "text-[#182B53] hover:bg-accent"
                          }`}
                      >
                        <Home className="h-4 w-4 mr-2" />
                        {t("nav.home")}
                      </Button>
                    </Link>

                    <Link to="/about" onClick={() => setIsOpen(false)}>
                      <Button
                        variant={pathname === "/about" ? "default" : "ghost"}
                        className={`w-full justify-start border-0 ${pathname === "/about"
                            ? "bg-[#182B53] text-white"
                            : "text-[#182B53] hover:bg-accent"
                          }`}
                      >
                        {t("nav.about")}
                      </Button>
                    </Link>

                    <Link to="/templates" onClick={() => setIsOpen(false)}>
                      <Button
                        variant={pathname === "/templates" ? "default" : "ghost"}
                        className={`w-full justify-start border-0 ${pathname === "/templates"
                            ? "bg-[#182B53] text-white"
                            : "text-[#182B53] hover:bg-accent"
                          }`}
                      >
                        {t("nav.templates")}
                      </Button>
                    </Link>

                    <Link to="/contact" onClick={() => setIsOpen(false)}>
                      <Button
                        variant={pathname === "/contact" ? "default" : "ghost"}
                        className={`w-full justify-start border-0 ${pathname === "/contact"
                            ? "bg-[#182B53] text-white"
                            : "text-[#182B53] hover:bg-accent"
                          }`}
                      >
                        {t("nav.contact")}
                      </Button>
                    </Link>
                  </>
                )}

                {/* User Actions */}
                {userData?.user?.role === "administrator" && (
                  <Link to="/admin" onClick={() => setIsOpen(false)}>
                    <Button
                      variant={pathname === "/admin" ? "default" : "ghost"}
                      className={`w-full justify-start border-0 ${pathname === "/admin"
                          ? "bg-[#182B53] text-white"
                          : "text-[#182B53] hover:bg-accent"
                        }`}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {t("nav.adminDashboard")}
                    </Button>
                  </Link>
                )}

                {userData?.user ? (
                  <>
                    {userData.user.role !== "administrator" && (
                      <>
                        <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                          <Button
                            variant={pathname === "/dashboard" ? "default" : "ghost"}
                            className={`w-full justify-start border-0 ${pathname === "/dashboard"
                              ? "bg-[#182B53] text-white"
                              : "text-[#182B53] hover:bg-accent"
                              }`}
                          >
                            <User className="h-4 w-4 mr-2" />
                            {t("nav.dashboard")}
                          </Button>
                        </Link>
                        <Link to="/profile" onClick={() => setIsOpen(false)}>
                          <Button
                            variant={pathname === "/profile" ? "default" : "ghost"}
                            className={`w-full justify-start border-0 ${pathname === "/profile"
                              ? "bg-[#182B53] text-white"
                              : "text-[#182B53] hover:bg-accent"
                              }`}
                          >
                            <User className="h-4 w-4 mr-2" />
                            {t("nav.myAccount") || "My Account"}
                          </Button>
                        </Link>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="w-full justify-start border-0 text-[#182B53] hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t("actions.logout")}
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button
                      variant={pathname === "/auth" ? "default" : "ghost"}
                      className={`w-full justify-start border-0 ${pathname === "/auth"
                          ? "bg-[#182B53] text-white"
                          : "text-[#182B53] hover:bg-accent"
                        }`}
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t("actions.login")}
                    </Button>
                  </Link>
                )}

                {/* Language Switcher */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">{t("nav.languages")}</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        i18n.changeLanguage("en");
                        localStorage.setItem("language", "en");
                        setIsOpen(false);
                      }}
                      className={`px-3 py-2 text-sm rounded bg-background border text-[#182B53] hover:bg-accent flex items-center gap-2 ${i18n.language === "en" ? "border-primary bg-accent" : ""}`}
                      aria-label="English"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="24" height="16">
                        <clipPath id="uk-mobile1"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
                        <clipPath id="uk-mobile2"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
                        <g clipPath="url(#uk-mobile1)">
                          <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
                          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
                          <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-mobile2)" stroke="#C8102E" strokeWidth="4"/>
                          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
                          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
                        </g>
                      </svg>
                      English
                    </button>
                    <button
                      onClick={() => {
                        i18n.changeLanguage("gr");
                        localStorage.setItem("language", "gr");
                        setIsOpen(false);
                      }}
                      className={`px-3 py-2 text-sm rounded bg-background border text-[#182B53] hover:bg-accent flex items-center gap-2 ${i18n.language === "gr" ? "border-primary bg-accent" : ""}`}
                      aria-label="Greek"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 18" width="24" height="16">
                        <rect fill="#0D5EAF" width="27" height="18"/>
                        <path fill="#FFF" d="M0,2h27v2H0zM0,6h27v2H0zM0,10h27v2H0zM0,14h27v2H0z"/>
                        <rect fill="#0D5EAF" width="10" height="10"/>
                        <path fill="#FFF" d="M0,4h10v2H0zM4,0h2v10H4z"/>
                      </svg>
                      Ελληνικά
                    </button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center justify-between space-x-4 w-full">
          <NavLinks />
        </div>
      </div>
    </nav>
  );
}

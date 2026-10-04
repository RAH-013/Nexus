import Swal from "sweetalert2";

const baseConfig = {
  background: "#0f172a",
  color: "#f8fafc",
  buttonsStyling: false,
  customClass: {
    popup: "nexus-swal-popup",
    title: "nexus-swal-title",
    htmlContainer: "nexus-swal-text",
    confirmButton: "nexus-swal-confirm",
    cancelButton: "nexus-swal-cancel",
  },
};

export const swal = Swal.mixin(baseConfig);

export const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: "#1e293b",
  color: "#f8fafc",
  customClass: {
    popup: "nexus-toast",
  },
});

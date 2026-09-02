import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";

const CorTexto = "#8E1948";
const CorFundo = "#FBE1EA";
const CorBotaoPrimario = "#8E1948";

export default function PerfilScreen({ navigation }: any) {
  const usuario = auth.currentUser;
  function primeirosDoisNomes(nomeCompleto?: string | null) {
  if (!nomeCompleto) return "Nome de Usuário";
  return nomeCompleto.trim().split(/\s+/).slice(0, 2).join(" ");}
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  async function handleAlterarSenha() {
    if (!usuario?.email) return;

    setEnviandoEmail(true);
    try {
      await sendPasswordResetEmail(auth, usuario.email);
      Alert.alert(
        "E-mail enviado",
        "Enviamos um link para você redefinir sua senha no e-mail cadastrado."
      );
    } catch {
      Alert.alert("Erro", "Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setEnviandoEmail(false);
    }
  }

  async function handleSair() {
    try {
      await signOut(auth);
      navigation?.replace("Login");
    } catch {
      Alert.alert("Erro", "Não foi possível sair. Tente novamente.");
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.botaoVoltar} onPress={() => navigation?.goBack()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.titulo}>Meu Perfil</Text>

      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={50} color="#B0B0B0" />
        </View>
        <TouchableOpacity style={styles.botaoEditarAvatar}>
          <Ionicons name="pencil" size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.linha} />
      <Text style={styles.nomeUsuario}>{primeirosDoisNomes(usuario?.displayName)}</Text>
      <Text style={styles.emailUsuario}>{usuario?.email || "seuemail@exemplo.com"}</Text>
      <View style={styles.linha} />

      <TouchableOpacity style={styles.botaoPrimario}>
        <Text style={styles.textoBotaoPrimario}>Editar perfil</Text>
        <Ionicons name="pencil" size={16} color="#fff" style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botaoSecundario}
        onPress={handleAlterarSenha}
        disabled={enviandoEmail}
      >
        <Text style={styles.textoBotaoSecundario}>
          {enviandoEmail ? "Enviando..." : "Alterar Senha"}
        </Text>
        <Ionicons name="lock-closed-outline" size={16} color={CorTexto} style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation?.navigate("ExcluirConta")}>
        <Text style={styles.linkExcluir}>Excluir Conta</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linhaSair} onPress={handleSair}>
        <Ionicons name="log-out-outline" size={18} color="#D32F2F" />
        <Text style={styles.textoSair}>Sair</Text>
      </TouchableOpacity>

      <Image source={require("../../../assets/uniceplac-logo.png")} style={styles.logoUniceplac} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CorFundo, padding: 24, paddingTop: 60, alignItems: "center" },
  botaoVoltar: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0356F",
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 36, fontWeight: "bold", color: CorTexto, marginBottom: 32 },
  avatarContainer: { marginBottom: 24 },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: CorTexto,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoEditarAvatar: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CorTexto,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CorFundo,
  },
  linha: { width: "100%", height: 1, backgroundColor: CorTexto, opacity: 0.3, marginVertical: 18 },
  nomeUsuario: { fontSize: 28, fontWeight: "bold", color: CorTexto },
  emailUsuario: { fontSize: 17, color: CorTexto, opacity: 0.8, marginTop: 6 },
  botaoPrimario: {
    flexDirection: "row",
    backgroundColor: CorBotaoPrimario,
    borderRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 28,
  },
  textoBotaoPrimario: { color: "#fff", fontWeight: "bold", fontSize: 19 },
  botaoSecundario: {
    flexDirection: "row",
    borderColor: CorBotaoPrimario,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 18,
  },
  textoBotaoSecundario: { color: CorTexto, fontWeight: "bold", fontSize: 19 },
  linkExcluir: { color: "#D32F2F", fontWeight: "bold", fontSize: 17, marginTop: 32 },
  linhaSair: { flexDirection: "row", alignItems: "center", marginTop: 22 },
  textoSair: { color: "#D32F2F", fontWeight: "bold", fontSize: 19, marginLeft: 8 },
  logoUniceplac: { width: 170, height: 100, resizeMode: "contain", marginTop: 24 },
});
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";

const CorDestaque = "#8E1948";
const CorCaixaClara = "#F8D7E3";
const CorCaixaEscura = "#D998B5";

function CampoComIcone({
  icone,
  label,
  valor,
  aoMudar,
  placeholder,
  secreto,
  mostrarTexto,
  aoAlternarMostrar,
  teclado,
}: {
  icone: any;
  label: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  secreto?: boolean;
  mostrarTexto?: boolean;
  aoAlternarMostrar?: () => void;
  teclado?: "default" | "email-address";
}) {
  return (
    <View style={styles.campoComIcone}>
      <Ionicons name={icone} size={20} color={CorDestaque} style={styles.iconeEsquerda} />
      <View style={{ flex: 1 }}>
        <Text style={styles.labelDentro}>
          {label} <Text style={styles.asterisco}>*</Text>
        </Text>
        <TextInput
          style={styles.inputDentro}
          placeholder={placeholder}
          placeholderTextColor="#9C7284"
          value={valor}
          onChangeText={aoMudar}
          autoCapitalize={teclado === "email-address" ? "none" : "sentences"}
          keyboardType={teclado || "default"}
          secureTextEntry={secreto ? !mostrarTexto : false}
        />
      </View>
      {secreto && (
        <TouchableOpacity onPress={aoAlternarMostrar} style={styles.iconeDireita}>
          <Ionicons name={mostrarTexto ? "eye-off-outline" : "eye-outline"} size={20} color={CorDestaque} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CadastroScreen({ navigation, route}: any) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  useEffect(() => {
    if (route?.params?.termosAceitos) {
      setAceitouTermos(true);
    }
  }, [route?.params?.termosAceitos]);

  function emailValido(valor: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  function senhaForte(valor: string) {
    const temMaiuscula = /[A-Z]/.test(valor);
    const temNumero = /[0-9]/.test(valor);
    const temEspecial = /[^A-Za-z0-9]/.test(valor);
    return valor.length >= 8 && temMaiuscula && temNumero && temEspecial;
  }

  function mensagemDeErro(codigo: string) {
    switch (codigo) {
      case "auth/email-already-in-use":
        return "Este e-mail já está cadastrado.";
      case "auth/invalid-email":
        return "E-mail inválido.";
      case "auth/weak-password":
        return "A senha precisa ter pelo menos 6 caracteres.";
      default:
        return "Não foi possível criar a conta. Tente novamente.";
    }
  }

  async function handleCriarConta() {
    if (!nome.trim() || !email.trim() || !senha || !confirmarSenha) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos.");
      return;
    }
    if (!emailValido(email)) {
      Alert.alert("E-mail inválido", "Digite um e-mail válido.");
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert("Senhas diferentes", "A senha e a confirmação não coincidem.");
      return;
    }
    if (!senhaForte(senha)) {
      Alert.alert(
        "Senha fraca",
        "A senha precisa ter no mínimo 8 caracteres, incluindo 1 letra maiúscula, 1 número e 1 caractere especial."
      );
      return;
    }
    if (!aceitouTermos) {
      Alert.alert("Termos de Uso", "Você precisa aceitar os Termos de Uso.");
      return;
    }

    setCarregando(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), senha);
      navigation.replace("Login");
    } catch (erro: any) {
      Alert.alert("Erro", mensagemDeErro(erro.code));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <LinearGradient colors={["#8E1948", "#C24B72", "#F8D7E3"]} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.cabecalho}>
          <Image source={require("../../../assets/rosa-logo.png")} style={styles.logo} />
          <Text style={styles.nomeApp}>Rosa IA</Text>
        </View>

        <Text style={styles.titulo}>Criar Conta</Text>

        <CampoComIcone
          icone="person-outline"
          label="Nome Completo"
          valor={nome}
          aoMudar={setNome}
          placeholder="Digite seu nome completo"
        />
        <CampoComIcone
          icone="mail-outline"
          label="E-mail"
          valor={email}
          aoMudar={setEmail}
          placeholder="Digite seu e-mail"
          teclado="email-address"
        />
        <CampoComIcone
          icone="lock-closed-outline"
          label="Senha"
          valor={senha}
          aoMudar={setSenha}
          placeholder="Digite sua senha"
          secreto
          mostrarTexto={mostrarSenha}
          aoAlternarMostrar={() => setMostrarSenha(!mostrarSenha)}
        />
        <CampoComIcone
          icone="lock-closed-outline"
          label="Confirmar Senha"
          valor={confirmarSenha}
          aoMudar={setConfirmarSenha}
          placeholder="Confirme sua senha"
          secreto
          mostrarTexto={mostrarConfirmarSenha}
          aoAlternarMostrar={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
        />

        <TouchableOpacity style={styles.linhaTermos} onPress={() => setAceitouTermos(!aceitouTermos)}>
          <View style={styles.checkbox}>
            {aceitouTermos && <Ionicons name="checkmark" size={14} color={CorDestaque} />}
          </View>
          <Text style={styles.textoTermos}>
            Eu li e concordo com os{" "}
            <Text style={styles.linkDestacado} onPress={() => navigation?.navigate("TermosDeUso")}>
              Termos de Uso
            </Text>{" "}
            e a{" "}
            <Text style={styles.linkDestacado} onPress={() => navigation?.navigate("TermosDeUso")}>
              Política de Privacidade
            </Text>
            .
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botao} onPress={handleCriarConta} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBotao}>Criar conta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation?.navigate("Login")}>
          <Text style={styles.linkLogin}>
            Já possui uma conta? <Text style={styles.linkDestacado}>Entrar</Text>
          </Text>
        </TouchableOpacity>

        <Image source={require("../../../assets/uniceplac-logo.png")} style={styles.logoUniceplac} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 18, justifyContent: "flex-start" },
  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginBottom: 0 },
  logo: { width: 190, height: 190, resizeMode: "contain", marginRight: -20 },
  nomeApp: { fontSize: 26, fontWeight: "bold", color: "#fff" },
  titulo: { fontSize: 42, fontWeight: "bold", color: "#fff", textAlign: "center", marginTop: -28, marginBottom: 20 },
  campoComIcone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CorCaixaClara,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  iconeEsquerda: { marginRight: 8 },
  iconeDireita: { marginLeft: 8 },
  labelDentro: { color: "#2A0A16", fontWeight: "600", fontSize: 13 },
  asterisco: { color: "#FF3B30" },
  inputDentro: { color: "#2A0A16", fontSize: 15, paddingVertical: 2 },
  linhaTermos: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: CorCaixaEscura,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textoTermos: { color: "#2A0A16", flex: 1, fontSize: 13 },
  linkDestacado: { color: CorDestaque, fontWeight: "bold" },
  botao: { backgroundColor: CorDestaque, borderRadius: 30, padding: 16, alignItems: "center", marginTop: 16 },
  textoBotao: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  linkLogin: { color: "#2A0A16", textAlign: "center", marginTop: 16 },
  logoUniceplac: { width: 170, height: 100, resizeMode: "contain", alignSelf: "center", marginTop: 12 },
});
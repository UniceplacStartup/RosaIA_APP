import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CorTexto = "#8E1948";
const CorSubtitulo = "#B15E7E";
const CorCard = "#F5CEDD";
const CorFundo = "#FBE1EA";
const CorBotaoVoltar = "#E0356F";

export default function TermosDeUsoScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.botaoVoltar} onPress={() => navigation?.goBack()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.titulo}>Termo de Uso</Text>
        <Text style={styles.subtitulo}>Leia com atenção antes de utilizar o aplicativo.</Text>

        <View style={styles.cabecalho}>
          <Image source={require("../../../assets/rosa-logo.png")} style={styles.logo} />
          <Text style={styles.nomeApp}>Rosa IA</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.secaoTitulo}>Aviso Importante:</Text>
          <Text style={styles.paragrafo}>
            O RosaIA é uma solução assistencial desenvolvida como ferramenta de apoio informativo e educacional.
          </Text>

          <Text style={styles.secaoTitulo}>O aplicativo NÃO realiza:</Text>
          <Text style={styles.item}>•  Não realiza diagnósticos médicos;</Text>
          <Text style={styles.item}>•  Não substitui médicos ou profissionais de saúde;</Text>
          <Text style={styles.item}>•  Não realiza consultas ou atendimentos clínicos;</Text>
          <Text style={styles.item}>•  Não agenda exames presenciais ou laboratoriais;</Text>
          <Text style={styles.item}>•  Não realiza tratamentos ou prescrições médicas.</Text>

          <Text style={styles.secaoTitulo}>Atuação Oficial:</Text>
          <Text style={styles.paragrafo}>
            O RosaIA atua exclusivamente como uma ferramenta educativa e informativa, incentivando a prevenção, o
            autocuidado e o esclarecimento de dúvidas sobre a saúde mamária.
          </Text>

          <Text style={styles.secaoTitulo}>Tratamento de Dados Pessoais e Sensíveis:</Text>
          <Text style={styles.paragrafo}>
            Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), informações sobre saúde são
            consideradas dado pessoal sensível. Coletamos apenas os dados necessários para o funcionamento do
            aplicativo (nome, e-mail e histórico de conversas com a assistente), com sua autorização expressa.
          </Text>
          <Text style={styles.paragrafo}>
            Seus dados não são vendidos a terceiros. Você pode, a qualquer momento, solicitar a exclusão da sua
            conta e dos dados associados a ela, conforme seus direitos previstos no art. 18 da LGPD.
          </Text>

          <Text style={styles.secaoTitulo}>Aceite:</Text>
          <Text style={styles.paragrafo}>
            Ao utilizar o RosaIA, você declara estar ciente e de acordo com os termos acima.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.botaoConcordo}
          onPress={() => navigation?.navigate("Cadastro", { termosAceitos: true })}>
          <Text style={styles.textoBotaoConcordo}>Li e Concordo</Text>
        </TouchableOpacity>

        <Image source={require("../../../assets/uniceplac-logo.png")} style={styles.logoUniceplac} />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CorFundo },
  botaoVoltar: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CorBotaoVoltar,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 100, paddingBottom: 40 },
  titulo: { fontSize: 30, fontWeight: "bold", color: CorTexto },
  subtitulo: { fontSize: 13, color: CorSubtitulo, marginTop: 4, marginBottom: 24 },
  cabecalho: { flexDirection: "row", alignItems: "center", marginTop: -40, marginBottom: -60, marginLeft: -110 },
  logo: { width: 340, height: 340, resizeMode: "contain", marginRight: -50 },
  nomeApp: { fontSize: 46, fontWeight: "bold", color: CorTexto, marginTop: -55 },
  card: { backgroundColor: CorCard, borderRadius: 16, padding: 20 },
  secaoTitulo: { fontSize: 20, fontWeight: "bold", color: CorTexto, marginTop: 16, marginBottom: 8 },
  paragrafo: { fontSize: 14, color: CorTexto, lineHeight: 20, marginBottom: 8 },
  item: { fontSize: 14, color: CorTexto, lineHeight: 20, marginBottom: 6 },
  logoUniceplac: { width: 170, height: 100, resizeMode: "contain", alignSelf: "center", marginTop: 24 },
  botaoConcordo: {
    backgroundColor: CorTexto,
    borderRadius: 30,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  textoBotaoConcordo: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontSize: 10,
    fontFamily: "Helvetica",
  },

  /* CONTAINER */
  container: {
    width: "100%",
    flex: 1,
    alignItems: "center",
  },

  /* HEADER */
  header: {
    width: "100%",
    maxWidth: 540,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  logo: {
    width: 70,
    height: 60,
    marginRight: 10,
  },

  schoolBlock: {
    flexDirection: "column",
  },

  schoolName: {
    fontSize: 14,
    fontWeight: "bold",
  },

  subText: {
    fontSize: 9,
    color: "#555",
  },

  headerRight: {
    fontSize: 9,
    textAlign: "right",
  },

  /* RED LINE */
  lineRed: {
    width: "100%",
    maxWidth: 540,
    borderBottomWidth: 2,
    borderBottomColor: "red",
    marginVertical: 10,
  },

  /* CONTENT */
  content: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },

  /* TITLE */
  titleWrapper: {
    marginVertical: 10,
    alignItems: "center",
  },

  title: {
    fontSize: 15,
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  /* MAIN TABLE */
  table: {
    width: "100%",
    maxWidth: 540,
    marginTop: 10,
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    minHeight: 22,
    alignItems: "center",
    width: "100%",
  },

  headerRow: {
    backgroundColor: "#f2f2f2",
  },

  cell: {
    flex: 1,
    padding: 4,
    fontSize: 8,
  },

  headerCell: {
    flex: 1,
    padding: 4,
    fontSize: 8,
    fontWeight: "bold",
  },

  /* TOTAL TABLE */
  totalWrapper: {
    width: "100%",
    maxWidth: 540,
    alignItems: "flex-end",
    marginTop: 8,
  },

  totalTable: {
    width: 320,
    borderWidth: 1,
    borderColor: "#000",
  },

  totalRow: {
    flexDirection: "row",
  },

  totalHeader: {
    backgroundColor: "#eaeaea",
  },

  totalCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    padding: 3,
    fontSize: 7,
    textAlign: "center",
  },

  totalHeaderCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    padding: 3,
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },

  /* FOOTER */
  footer: {
    width: "100%",
    maxWidth: 540,
    textAlign: "center",
    fontSize: 8,
    color: "#666",
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 6,
  },
});

export const PaiementsPDF = ({ data }: any) => {
  const taux = 2300;

  /* ENTREES */
  const totalUSDIn = data.reduce((sum: number, g: any) => sum + g.total, 0);

  const totalCDFIn = totalUSDIn * taux;

  /* SORTIES */
  const totalUSDOut = 0;
  const totalCDFOut = 0;

  /* RESTE */
  const resteUSD = totalUSDIn - totalUSDOut;
  const resteCDF = totalCDFIn - totalCDFOut;
  /* eslint-disable jsx-a11y/alt-text */
  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image src="/cmj.jpg" style={styles.logo} />
              <View style={styles.schoolBlock}>
                <Text style={styles.schoolName}>MON ÉCOLE</Text>

                <Text style={styles.subText}>Kinshasa - RDC</Text>

                <Text style={styles.subText}>+243 XXX XXX XXX</Text>

                <Text style={styles.subText}>contact@ecole.com</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <Text>Rapport Système</Text>

              <Text>{new Date().toLocaleDateString()}</Text>
            </View>
          </View>

          {/* RED LINE */}
          <View style={styles.lineRed} />

          {/* CONTENT */}
          <View style={styles.content}>
            {/* TITLE */}
            <View style={styles.titleWrapper}>
              <Text style={styles.title}>RAPPORT DES PAIEMENTS</Text>
            </View>

            {/* TABLE PRINCIPALE */}
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={styles.headerCell}>Référence</Text>

                <Text style={styles.headerCell}>Parent</Text>

                <Text style={styles.headerCell}>Élèves</Text>

                <Text style={styles.headerCell}>USD</Text>

                <Text style={styles.headerCell}>CDF</Text>

                <Text style={styles.headerCell}>Mode</Text>

                <Text style={styles.headerCell}>Statut</Text>
              </View>

              {data.map((g: any, i: number) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.cell}>{g.reference}</Text>

                  <Text style={styles.cell}>{g.parentName}</Text>

                  <Text style={styles.cell}>{g.students.join(", ")}</Text>

                  <Text style={styles.cell}>{g.total} $</Text>

                  <Text style={styles.cell}>{g.total * taux} FC</Text>

                  <Text style={styles.cell}>{g.mode}</Text>

                  <Text style={styles.cell}>{g.status}</Text>
                </View>
              ))}
            </View>

            {/* PETIT TABLEAU TOTAL */}
            <View style={styles.totalWrapper}>
              <View style={styles.totalTable}>
                {/* HEADER */}
                <View style={[styles.totalRow, styles.totalHeader]}>
                  <Text style={styles.totalHeaderCell}>Taux</Text>

                  <Text style={styles.totalHeaderCell}>Entrée USD</Text>

                  <Text style={styles.totalHeaderCell}>Entrée CDF</Text>

                  <Text style={styles.totalHeaderCell}>Sortie USD</Text>

                  <Text style={styles.totalHeaderCell}>Sortie CDF</Text>
                </View>

                {/* DATA */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalCell}>{taux}</Text>

                  <Text style={styles.totalCell}>{totalUSDIn} $</Text>

                  <Text style={styles.totalCell}>{totalCDFIn} FC</Text>

                  <Text style={styles.totalCell}>{totalUSDOut} $</Text>

                  <Text style={styles.totalCell}>{totalCDFOut} FC</Text>
                </View>

                {/* RESTE */}
                <View style={styles.totalRow}>
                  <Text
                    style={[
                      styles.totalCell,
                      {
                        flex: 2,
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    RESTE RÉEL
                  </Text>

                  <Text
                    style={[
                      styles.totalCell,
                      {
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {resteUSD} $
                  </Text>

                  <Text
                    style={[
                      styles.totalCell,
                      {
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {resteCDF} FC
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text>
              MON ÉCOLE • Kinshasa - RDC • +243 XXX XXX XXX • contact@ecole.com
            </Text>

            <Text>
              Document officiel généré automatiquement par le système de gestion
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

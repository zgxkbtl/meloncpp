export const samples = [
  {
    name: 'A + B', tag: '基础输入输出', input: '3\n1 2\n100 200\n-5 8\n', expected: '3\n300\n3\n',
    code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t;
    cin >> t;
    while (t--) {
        long long a, b;
        cin >> a >> b;
        cout << a + b << '\\n';
    }
    return 0;
}
`,
  },
  {
    name: '最短路 Dijkstra', tag: '图论 · STL',
    input: '5 6 1\n1 2 2\n1 3 5\n2 3 1\n2 4 6\n3 4 2\n4 5 1\n', expected: '0 2 3 5 6\n',
    code: `#include <bits/stdc++.h>
using namespace std;
using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m, s;
    cin >> n >> m >> s;
    vector<vector<pair<int, int>>> g(n + 1);
    for (int i = 0, u, v, w; i < m; ++i) {
        cin >> u >> v >> w;
        g[u].emplace_back(v, w);
    }
    const ll INF = (1LL << 60);
    vector<ll> d(n + 1, INF);
    priority_queue<pair<ll, int>, vector<pair<ll, int>>,
                   greater<pair<ll, int>>> pq;
    d[s] = 0;
    pq.emplace(0, s);
    while (!pq.empty()) {
        auto [du, u] = pq.top();
        pq.pop();
        if (du != d[u]) continue;
        for (auto [v, w] : g[u]) {
            if (d[v] > du + w) {
                d[v] = du + w;
                pq.emplace(d[v], v);
            }
        }
    }
    for (int i = 1; i <= n; ++i) {
        if (i > 1) cout << ' ';
        cout << (d[i] == INF ? -1 : d[i]);
    }
    cout << '\\n';
}
`,
  },
  {
    name: '并查集 DSU', tag: '数据结构', input: '5 5\n1 1 2\n1 2 3\n2 1 3\n2 1 4\n2 4 5\n', expected: 'Yes\nNo\nNo\n',
    code: `#include <bits/stdc++.h>
using namespace std;

struct DSU {
    vector<int> p, sz;
    DSU(int n) : p(n + 1), sz(n + 1, 1) {
        iota(p.begin(), p.end(), 0);
    }
    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (sz[a] < sz[b]) swap(a, b);
        p[b] = a; sz[a] += sz[b];
    }
};
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q; cin >> n >> q;
    DSU d(n);
    while (q--) {
        int op, a, b; cin >> op >> a >> b;
        if (op == 1) d.unite(a, b);
        else cout << (d.find(a) == d.find(b) ? "Yes" : "No") << '\\n';
    }
}
`,
  },
];
